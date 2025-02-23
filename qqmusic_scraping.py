from flask import Flask, jsonify, Response
import requests
from langdetect import detect
import sqlite3
from datetime import datetime
import logging
import json
import re
import asyncio
import httpx
from googletrans import Translator

# terminal run cmd: py qqmusic_scraping.py

app = Flask(__name__)

# logging config
logging.basicConfig(level = logging.INFO)
logger = logging.getLogger(__name__)

# translator config
translator = Translator()

# api endpoints
QQ_MUSIC_CHARTS_URL = "http://localhost:3200/getTopLists"
QQ_MUSIC_CHART_DETAILS_URL = "http://localhost:3200/getRanks?topId={topId}"

# in-memory cache for MIDs
mid_cache = {}

def get_mid_from_cache(title, artist):
    key = f"{normalize_string(title)}_{normalize_string(artist)}"
    return mid_cache.get(key)

def save_mid_to_cache(title, artist, mid):
    key = f"{normalize_string(title)}_{normalize_string(artist)}"
    mid_cache[key] = mid

def normalize_string(s):
    return re.sub(r"[^a-zA-Z0-9]", "", s.lower().strip())

# database initialization
def init_database():
    db = sqlite3.connect("qq_charts.db")
    cursor = db.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracks(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            song_mid TEXT UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS charts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            platform TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_snapshots(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id INTEGER NOT NULL,
            chart_id INTEGER NOT NULL,
            rank INTEGER NOT NULL,
            streams INTEGER DEFAULT 0,
            date_scraped TEXT NOT NULL,
            FOREIGN KEY (track_id) REFERENCES tracks(id),
            FOREIGN KEY (chart_id) REFERENCES charts(id),
            UNIQUE(track_id, chart_id, date_scraped)
        )""")

    db.commit()
    db.close()
    logger.info("Database initialized with updated schema")

# fetching data from qq api
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
        logger.error(f"Error from {url}: {e}")
        return None

# saving tracks and charts to database
def save_tracks_and_charts(tracks, platform, chart_name):
    try:
        db = sqlite3.connect("qq_charts.db")
        cursor = db.cursor()

        cursor.execute("SELECT id FROM charts WHERE name = ? AND platform = ?", (chart_name, platform))
        chart_id = cursor.fetchone()
        if not chart_id:
            cursor.execute("INSERT INTO charts (name, platform) VALUES (?, ?)", (chart_name, platform))
            chart_id = cursor.lastrowid
        else:
            chart_id = chart_id[0]

        date_scraped = datetime.now().strftime("%Y-%m-%d")

        for track in tracks:
            title = track["title"]
            artist = track["artist"]
            rank = track.get("rank")
            song_mid = track.get("song_mid", None)

            cursor.execute("SELECT id FROM tracks WHERE title = ? AND artist = ?", (title, artist))
            track_id = cursor.fetchone()
            if not track_id:
                cursor.execute(
                    "INSERT INTO tracks (title, artist, song_mid) VALUES (?, ?, ?)",
                    (title, artist, song_mid),
                )
                track_id = cursor.lastrowid
            else:
                track_id = track_id[0]

            # add daily snapshot
            cursor.execute("""
                INSERT OR IGNORE INTO daily_snapshots (track_id, chart_id, rank, date_scraped)
                VALUES (?, ?, ?, ?)""",
                (track_id, chart_id, rank, date_scraped))

        db.commit()
        db.close()
        logger.info(f"Tracks and snapshots saved for chart: {chart_name}")

    except sqlite3.Error as e:
        logger.error(f"Error saving tracks and charts: {e}")

# regex checking if text is in english
def is_english(text):
    return bool(re.fullmatch(r"[A-Za-z0-9\s.,'\"!?()&/:;-]+", text))

# translating chart name
def translate_chart_name(chart_name):
    try:
        translated = translator.translate(chart_name, src = "zh-cn", dest = "en")
        return f"{translated.text}"

    except Exception as e:
        logger.error(f"Translation error for {chart_name}: {e}")
        return chart_name

# async fetching song MIDs
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
        song_data = data.get('data', {}).get('song', {}).get('itemlist', [])

        for song in song_data:
            if normalize_string(song['name']) == normalize_string(title) and normalize_string(song['singer']) == normalize_string(artist):
                track_mid = song['mid']
                save_mid_to_cache(title, artist, track_mid)
                return track_mid
    except Exception as e:
        logger.error(f"Error fetching MID for {title} by {artist}: {e}")
    return None

async def get_all_mids(tracks):
    async with httpx.AsyncClient() as session:
        tasks = [fetch_mid_async(session, track["title"], track["artist"]) for track in tracks]
        return await asyncio.gather(*tasks)

# main route
@app.route("/scrape/qqmusic", methods = ["GET"])
def scrape_qqmusic():
    charts = qq_fetch_data(QQ_MUSIC_CHARTS_URL)
    target_top_ids = {4, 26, 27, 62, 57, 28, 3, 67}

    if (not charts) or ("response" not in charts) or ("data" not in charts["response"]):
        return jsonify({"Error": "Failed to fetch QQ charts"}), 500

    top_lists = charts["response"]["data"]["topList"]
    all_filtered_tracks = {}

    for chart in top_lists:
        if chart["id"] not in target_top_ids:
            continue

        chart_name = f"{chart['topTitle']} / {translate_chart_name(chart['topTitle'])}"
        chart_ID = chart["id"]

        logger.info(f"Processing chart: {chart_name} (ID: {chart_ID})")
        chart_data = qq_fetch_data(QQ_MUSIC_CHART_DETAILS_URL.format(topId = chart_ID))

        if not chart_data or "response" not in chart_data or "req_1" not in chart_data["response"]:
            logger.error(f"Failed to fetch {chart_name} {chart_ID}")
            continue

        track_list = chart_data["response"]["req_1"]["data"]["data"]["song"]

        for track in track_list:
            title = track["title"]
            artist = track["singerName"]
            rank = track.get("rank")

            if is_english(title) and is_english(artist):
                track_key = (title, artist)
                if track_key in all_filtered_tracks:
                    all_filtered_tracks[track_key]["chart_rank"][chart_name] = rank
                else:
                    all_filtered_tracks[track_key] = {
                        "title": title,
                        "artist": artist,
                        "chart_rank": {chart_name: rank},
                        "song_mid": None
                    }

    filtered_tracks = list(all_filtered_tracks.values())

    logger.info("Fetching MIDs for filtered tracks asynchronously")
    mids = asyncio.run(get_all_mids(filtered_tracks))

    for track, mid in zip(filtered_tracks, mids):
        track["song_mid"] = mid

    logger.info("Saving tracks to database")
    save_tracks_and_charts(filtered_tracks, "QQ Music", "Consolidated")
    logger.info("Tracks saved successfully")

    response_data = {"filtered_tracks": filtered_tracks}
    response_json = json.dumps(response_data, ensure_ascii = False, indent = 4)
    return Response(response_json, content_type = "application/json")

# default route
@app.route("/", methods = ["GET"])
def home():
    return "Flask server is up n running chief!"

if __name__ == "__main__":
    logger.info("Starting Flask app")
    init_database()
    app.run(debug = True)