from flask import Flask, jsonify, Response
import requests
import psycopg2
from datetime import datetime
import logging
import json
import re
import asyncio
import httpx
import os

# terminal run cmd: py qqmusic_scraping.py

# logging config
logging.basicConfig(level = logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# supabase db connection details
SUPABASE_HOST = os.environ.get("SUPABASE_HOST")
SUPABASE_DB = os.environ.get("SUPABASE_DB")
SUPABASE_USER = os.environ.get("SUPABASE_USER")
SUPABASE_PASSWORD = os.environ.get("SUPABASE_PASSWORD")
SUPABASE_PORT = os.environ.get("SUPABASE_PORT", "5433")

def get_db_connection():
    conn = psycopg2.connect(
        host = SUPABASE_HOST,
        port = SUPABASE_PORT,
        database = SUPABASE_DB,
        user = SUPABASE_USER,
        password = SUPABASE_PASSWORD
    )
    return conn

# api endpoints
QQ_MUSIC_CHARTS_URL = "http://localhost:3200/getTopLists"
QQ_MUSIC_CHART_DETAILS_URL = "http://localhost:3200/getRanks?topId={topId}"

# in-memory cache for mids
mid_cache = {}

def get_mid_from_cache(title, artist):
    key = f"{normalize_string(title)}_{normalize_string(artist)}"
    return mid_cache.get(key)

def save_mid_to_cache(title, artist, mid):
    key = f"{normalize_string(title)}_{normalize_string(artist)}"
    mid_cache[key] = mid

def normalize_string(s):
    return re.sub(r"[^a-zA-Z0-9]", "", s.lower().strip())

def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracks(
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            song_mid TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(title, artist)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS charts(
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_snapshots(
            id SERIAL PRIMARY KEY,
            track_id INTEGER NOT NULL,
            chart_id INTEGER NOT NULL,
            yesterday_rank INTEGER,
            today_rank INTEGER NOT NULL,
            trend TEXT CHECK (trend IN ('up','down','stable','new','removed')),
            longevity INTEGER DEFAULT 1,
            date_scraped TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (track_id) REFERENCES tracks(id),
            FOREIGN KEY (chart_id) REFERENCES charts(id),
            UNIQUE(track_id, chart_id, date_scraped)
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()
    logger.info("Database initialized with TIMESTAMP columns")

def qq_fetch_data(url):
    try:
        logger.info(f"Fetching data from {url}")
        response = requests.get(url, timeout = 10)
        response.raise_for_status()
        data = response.json()
        if isinstance(data.get("response"), str):
            data["response"] = json.loads(data["response"])
        return data
    except (requests.RequestException, json.JSONDecodeError) as e:
        logger.error(f"Error fetching data from {url}: {e}")
        return None

def save_tracks_and_charts(tracks):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        date_scraped = datetime.now()
        active_pairs = set()

        for track in tracks:
            title = track["title"]
            artist = track["artist"]
            song_mid = track.get("song_mid")
            chart_ranks = track.get("chart_rank", {})

            cursor.execute(
                "SELECT id FROM tracks WHERE title = %s AND artist = %s",
                (title, artist)
            )
            track_id = cursor.fetchone()

            if not track_id:
                cursor.execute(
                    """
                    INSERT INTO tracks (title, artist, song_mid)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (title, artist) DO NOTHING
                    RETURNING id
                    """,
                    (title, artist, song_mid)
                )
                track_id = cursor.fetchone()
                if not track_id:
                    cursor.execute(
                        "SELECT id FROM tracks WHERE title = %s AND artist = %s",
                        (title, artist)
                    )
                    track_id = cursor.fetchone()

            track_id = track_id[0]

            for chart_name, rank in chart_ranks.items():
                cursor.execute("SELECT id FROM charts WHERE name = %s", (chart_name,))
                chart_id = cursor.fetchone()
                if not chart_id:
                    cursor.execute(
                        "INSERT INTO charts (name) VALUES (%s) RETURNING id",
                        (chart_name,)
                    )
                    chart_id = cursor.fetchone()

                chart_id = chart_id[0]
                active_pairs.add((track_id, chart_id))

                cursor.execute(
                    """
                    SELECT yesterday_rank, today_rank, trend, longevity, date_scraped
                    FROM daily_snapshots
                    WHERE track_id = %s AND chart_id = %s
                    ORDER BY date_scraped DESC
                    LIMIT 1
                    """,
                    (track_id, chart_id)
                )
                prev_snapshot = cursor.fetchone()

                if prev_snapshot:
                    prev_yesterday = prev_snapshot[0]
                    prev_today = prev_snapshot[1]
                    prev_longevity = prev_snapshot[3]
                    prev_date = prev_snapshot[4]
                    y_rank = prev_today
                    date_diff = (date_scraped.date() - prev_date.date()).days
                    if date_diff == 1:
                        new_longevity = prev_longevity + 1
                    else:
                        new_longevity = 1
                else:
                    y_rank = None
                    new_longevity = 1

                t_trend = compute_trend(y_rank, rank)

                cursor.execute(
                    """
                    INSERT INTO daily_snapshots (
                        track_id, chart_id, yesterday_rank, today_rank,
                        trend, longevity, date_scraped
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (track_id, chart_id, date_scraped)
                    DO UPDATE SET
                        yesterday_rank = EXCLUDED.yesterday_rank,
                        today_rank = EXCLUDED.today_rank,
                        trend = EXCLUDED.trend,
                        longevity = EXCLUDED.longevity
                    """,
                    (track_id, chart_id, y_rank, rank, t_trend, new_longevity, date_scraped)
                )

        if active_pairs:
            placeholders = []
            params = []
            for (tid, cid) in active_pairs:
                placeholders.append("(%s, %s)")
                params.extend([tid, cid])
            in_clause = ", ".join(placeholders)
            query = f"""
                DELETE FROM daily_snapshots
                WHERE (track_id, chart_id) NOT IN ({in_clause})
            """
            cursor.execute(query, params)
        else:
            cursor.execute("DELETE FROM daily_snapshots")

        cursor.execute(
            """
            DELETE FROM tracks
            WHERE id NOT IN (
                SELECT DISTINCT track_id FROM daily_snapshots
            )
            """
        )

        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Tracks and snapshots saved successfully with new multi-day logic.")
    except Exception as e:
        logger.error(f"Error saving tracks and charts: {e}")

def is_english(text):
    return bool(re.fullmatch(r"[A-Za-z0-9\s.,'\"!?()&/:;-]+", text))

async def fetch_mid_async(session, title, artist):
    cached_mid = get_mid_from_cache(title, artist)
    if cached_mid:
        return cached_mid

    url = "https://c6.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg"
    params = {
        "_": int(datetime.now().timestamp() * 1000),
        "cv": "4747474",
        "ct": "24",
        "format": "json",
        "inCharset": "utf-8",
        "outCharset": "utf-8",
        "notice": "0",
        "platform": "yqq.json",
        "needNewCode": "1",
        "uin": "0",
        "g_tk_new_20200303": "5381",
        "g_tk": "5381",
        "hostUin": "0",
        "is_xml": "0",
        "key": f"{title} {artist}"
    }

    try:
        logger.info(f"Fetching MID for {title} by {artist}")
        response = await session.get(url, params = params, timeout = 15)
        response.raise_for_status()
        data = response.json()
        song_data = data.get("data", {}).get("song", {}).get("itemlist", [])
        for song in song_data:
            if (normalize_string(song["name"]) == normalize_string(title)
                    and normalize_string(song["singer"]) == normalize_string(artist)):
                track_mid = song["mid"]
                save_mid_to_cache(title, artist, track_mid)
                return track_mid
    except Exception as e:
        logger.error(f"Error fetching MID for {title} by {artist}: {e}")
    return None

async def get_all_mids(tracks):
    async with httpx.AsyncClient() as session:
        tasks = [fetch_mid_async(session, track["title"], track["artist"]) for track in tracks]
        return await asyncio.gather(*tasks)
    
def compute_trend(yesterday_rank, today_rank):
    if yesterday_rank is None:
        return "new"
    if today_rank < yesterday_rank:
        return "up"
    elif today_rank > yesterday_rank:
        return "down"
    return "stable"

def perform_scrape():
    charts = qq_fetch_data(QQ_MUSIC_CHARTS_URL)
    target_top_ids = {4, 26, 27, 62, 57, 28, 3, 67}

    chart_name_translations = {
        "巅峰榜·流行指数": "Top Chart · Popularity Index",
        "巅峰榜·热歌": "Top Chart · Hot Songs",
        "巅峰榜·新歌": "Top Chart · New Songs",
        "飙升榜": "Rising Songs",
        "电音榜": "Electronic Music Chart",
        "巅峰榜·网络歌曲": "Top Chart · Internet Songs",
        "巅峰榜·欧美": "Top Chart · Europe and America",
        "听歌识曲榜": "Most Shazamed Songs"
    }

    if (not charts) or ("response" not in charts) or ("data" not in charts["response"]):
        logger.error("Failed to fetch QQ charts")
        return {"Error": "Failed to fetch QQ charts"}

    top_lists = charts["response"]["data"]["topList"]
    all_filtered_tracks = {}

    for chart in top_lists:
        if chart["id"] not in target_top_ids:
            continue

        chart_name = chart['topTitle']
        chart_ID = chart["id"]
        chart_name_translated = chart_name_translations.get(chart_name, chart_name)
        chart_display_name = f"{chart_name}/{chart_name_translated}"

        logger.info(f"Processing chart: {chart_display_name} (id: {chart_ID})")
        chart_data = qq_fetch_data(QQ_MUSIC_CHART_DETAILS_URL.format(topId = chart_ID))
        if not chart_data or "response" not in chart_data or "req_1" not in chart_data["response"]:
            logger.error(f"Failed to fetch {chart_display_name} {chart_ID}")
            continue

        track_list = chart_data["response"]["req_1"]["data"]["data"]["song"]

        for track in track_list:
            title = track["title"]
            artist = track["singerName"]
            rank = track.get("rank")

            if is_english(title) and is_english(artist):
                track_key = (title, artist)
                if track_key in all_filtered_tracks:
                    all_filtered_tracks[track_key]["chart_rank"][chart_display_name] = rank
                else:
                    all_filtered_tracks[track_key] = {
                        "title": title,
                        "artist": artist,
                        "chart_rank": {chart_display_name: rank},
                        "song_mid": None
                    }

    filtered_tracks = list(all_filtered_tracks.values())

    logger.info("Fetching MIDs for filtered tracks asynchronously")
    mids = asyncio.run(get_all_mids(filtered_tracks))
    for track, mid in zip(filtered_tracks, mids):
        track["song_mid"] = mid

    logger.info("Saving tracks to database")
    save_tracks_and_charts(filtered_tracks)
    logger.info("Tracks saved successfully")

    return {"filtered_tracks": filtered_tracks}

@app.route("/scrape/qqmusic", methods = ["GET"])
def scrape_qqmusic():
    data = perform_scrape()
    response_json = json.dumps(data, ensure_ascii = False, indent = 4)
    return Response(response_json, content_type = "application/json")

@app.route("/", methods = ["GET"])
def home():
    return "Flask server is up n running chief!"

if __name__ == "__main__":
    logger.info("Initializing database...")
    init_database()
    
    # CI environment
    if os.getenv("CI"):
        logger.info("CI environment detected, running scrape directly")
        data = perform_scrape()
        logger.info(f"Scraping done, found {len(data.get('filtered_tracks', []))} tracks")
    # local environment
    else:
        logger.info("Starting Flask app")
        app.run(debug = True)
