import psycopg2
import os
from datetime import datetime, timedelta
import json
import logging

logging.basicConfig(level = logging.INFO)
logger = logging.getLogger(__name__)

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

def get_recent_dates(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT DATE(date_scraped) AS snapshot_date
        FROM daily_snapshots
        ORDER BY snapshot_date DESC
    """)
    rows = cursor.fetchall()
    dates = [row[0] for row in rows]
    cursor.close()
    return dates

def get_snapshots_for_date(conn, date_value):
    cursor = conn.cursor()
    query = """
        SELECT
            ds.track_id,
            ds.chart_id,
            ds.yesterday_rank,
            ds.today_rank,
            ds.trend,
            ds.longevity,
            t.title,
            t.artist,
            c.name,
            ds.date_scraped
        FROM daily_snapshots ds
        JOIN tracks t ON ds.track_id = t.id
        JOIN charts c ON ds.chart_id = c.id
        WHERE DATE(ds.date_scraped) = %s
    """
    cursor.execute(query, (date_value,))
    rows = cursor.fetchall()
    snapshots = []
    
    for row in rows:
        snapshots.append({
            "track_id": row[0],
            "chart_id": row[1],
            "yesterday_rank": row[2],
            "today_rank": row[3],
            "trend": row[4],
            "longevity": row[5],
            "title": row[6],
            "artist": row[7],
            "chart_name": row[8],
            "timestamp_scraped": row[9],
            "rank": row[3]
        })
    cursor.close()
    return snapshots

def group_snapshots_by_chart(snapshots):
    chart_dict = {}

    for snap in snapshots:
        chart = snap["chart_name"]
        if chart not in chart_dict:
            chart_dict[chart] = []
        chart_dict[chart].append(snap)

    return chart_dict

def analyze_chart(tracks_today, tracks_yesterday):
    analysis = {"new_entries": [], "position_changes": [], "falling_off": []}
    yesterday_lookup = {snap["track_id"]: snap for snap in tracks_yesterday}

    for snap in tracks_today:
        track_id = snap["track_id"]
        title = snap["title"]
        artist = snap["artist"]
        today_rank = snap["rank"]

        if track_id in yesterday_lookup:
            yesterday_rank = yesterday_lookup[track_id]["rank"]
            rank_diff = yesterday_rank - today_rank

            if rank_diff >= 2:
                trend = "uptrending"
            elif rank_diff <= -2:
                trend = "downtrending"
            else:
                trend = "stable"
            analysis["position_changes"].append({
                "track_id": track_id,
                "title": title,
                "artist": artist,
                "chart": snap["chart_name"],
                "yesterday_rank": yesterday_rank,
                "today_rank": today_rank,
                "rank_change": rank_diff,
                "trend": trend
            })
        else:
            analysis["new_entries"].append({
                "track_id": track_id,
                "title": title,
                "artist": artist,
                "chart": snap["chart_name"],
                "today_rank": today_rank,
                "trend": "new entry"
            })

    today_ids = {snap["track_id"] for snap in tracks_today}

    for snap in tracks_yesterday:
        if snap["track_id"] not in today_ids:
            analysis["falling_off"].append({
                "track_id": snap["track_id"],
                "title": snap["title"],
                "artist": snap["artist"],
                "chart": snap["chart_name"],
                "yesterday_rank": snap["rank"],
                "trend": "falling off"
            })

    return analysis

def calculate_track_longevity(conn, track_id, ref_date):
    cursor = conn.cursor()
    query = """
        SELECT DATE(date_scraped)
        FROM daily_snapshots
        WHERE track_id = %s
        ORDER BY date_scraped DESC
    """
    cursor.execute(query, (track_id,))
    rows = cursor.fetchall()
    cursor.close()
    longevity = 0
    ref_date_obj = ref_date if isinstance(ref_date, datetime) else datetime(ref_date.year, ref_date.month, ref_date.day)

    for row in rows:
        ds_date = row[0]
        
        if ds_date == (ref_date_obj.date() - timedelta(days = longevity)):
            longevity += 1
        else:
            break

    return longevity

def analyze_cross_chart(snapshots):
    performance = {}
    for snap in snapshots:
        tid = snap["track_id"]

        if tid not in performance:
            performance[tid] = {
                "title": snap["title"],
                "artist": snap["artist"],
                "charts": [],
                "ranks": []
            }

        performance[tid]["charts"].append(snap["chart_name"])
        performance[tid]["ranks"].append(snap["rank"])

    for tid, data in performance.items():
        data["average_rank"] = sum(data["ranks"]) / len(data["ranks"])
        data["best_rank"] = min(data["ranks"])

    return performance

def main():
    conn = get_db_connection()
    dates = get_recent_dates(conn)

    if len(dates) < 2:
        logger.info("Not enough data for analysis. At least two distinct days of snapshots required.")
        conn.close()
        return
    
    today_date = dates[0]
    yesterday_date = dates[1]

    logger.info(f"Analyzing data for {today_date} and {yesterday_date}")
    snapshots_today = get_snapshots_for_date(conn, today_date)
    snapshots_yesterday = get_snapshots_for_date(conn, yesterday_date)
    charts_today = group_snapshots_by_chart(snapshots_today)
    charts_yesterday = group_snapshots_by_chart(snapshots_yesterday)

    analysis_result = {}

    for chart, today_snaps in charts_today.items():
        yesterday_snaps = charts_yesterday.get(chart, [])
        analysis_result[chart] = analyze_chart(today_snaps, yesterday_snaps)

    for snap in snapshots_today:
        track_id = snap["track_id"]
        longevity = calculate_track_longevity(conn, track_id, today_date)
        snap["longevity"] = longevity

    cross_chart_result = analyze_cross_chart(snapshots_today)
    results = {
        "date": str(today_date),
        "chart_analysis": analysis_result,
        "cross_chart_performance": cross_chart_result,
        "snapshots_today": snapshots_today
    }
    print(json.dumps(results, indent = 4, ensure_ascii = False))
    conn.close()

if __name__ == "__main__":
    logger.info("Starting data analysis...")
    main()