import sqlite3
from datetime import datetime, timedelta
import json
import logging

# terminal run cmd: py track_analysis.py

# logging config
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# get recent dates from daily_snapshots
def get_recent_dates(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT date_scraped FROM daily_snapshots ORDER BY date_scraped DESC")
    dates = [row[0] for row in cursor.fetchall()]
    return dates

# get snapshots for a given date
def get_snapshots_for_date(conn, date):
    cursor = conn.cursor()
    query = (
        "SELECT ds.track_id, ds.chart_id, ds.rank, t.title, t.artist, c.name "
        "FROM daily_snapshots ds "
        "JOIN tracks t ON ds.track_id = t.id "
        "JOIN charts c ON ds.chart_id = c.id "
        "WHERE ds.date_scraped = ?"
    )
    cursor.execute(query, (date,))
    rows = cursor.fetchall()
    snapshots = []
    
    for row in rows:
        snapshots.append({
            "track_id": row[0],
            "chart_id": row[1],
            "rank": row[2],
            "title": row[3],
            "artist": row[4],
            "chart_name": row[5]
        })
        
    return snapshots

# group snapshots by chart
def group_snapshots_by_chart(snapshots):
    chart_dict = {}
    
    for snap in snapshots:
        chart = snap["chart_name"]
        
        if chart not in chart_dict:
            chart_dict[chart] = []
            
        chart_dict[chart].append(snap)
        
    return chart_dict

# analyze a chart for new entries, rank changes, and falling off tracks
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

# calculate track longevity (consecutive days on chart)
def calculate_track_longevity(conn, track_id, today_date):
    cursor = conn.cursor()
    query = "SELECT date_scraped FROM daily_snapshots WHERE track_id = ? ORDER BY date_scraped DESC"
    cursor.execute(query, (track_id,))
    rows = cursor.fetchall()
    longevity = 0
    current_date = datetime.strptime(today_date, "%Y-%m-%d").date()
    
    for row in rows:
        date_scraped = datetime.strptime(row[0], "%Y-%m-%d").date()
        
        if date_scraped == current_date - timedelta(days = longevity):
            longevity += 1
        else:
            break
        
    return longevity

# analyze cross-chart performance (avg and best rank)
def analyze_cross_chart(snapshots):
    performance = {}
    
    for snap in snapshots:
        track_id = snap["track_id"]
        
        if track_id not in performance:
            performance[track_id] = {
                "title": snap["title"],
                "artist": snap["artist"],
                "charts": [],
                "ranks": []
            }
            
        performance[track_id]["charts"].append(snap["chart_name"])
        performance[track_id]["ranks"].append(snap["rank"])
        
    for track_id, data in performance.items():
        data["average_rank"] = sum(data["ranks"]) / len(data["ranks"])
        data["best_rank"] = min(data["ranks"])
        
    return performance

# main function for data analysis
def main():
    db_path = "qq_charts.db"
    conn = sqlite3.connect(db_path)
    dates = get_recent_dates(conn)
    
    if len(dates) < 2:
        logger.info("Not enough data for analysis. At least two days of snapshots required.")
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
        longevity = calculate_track_longevity(conn, snap["track_id"], today_date)
        snap["longevity"] = longevity
        
    cross_chart_result = analyze_cross_chart(snapshots_today)
    results = {
        "date": today_date,
        "chart_analysis": analysis_result,
        "cross_chart_performance": cross_chart_result,
        "snapshots_today": snapshots_today
    }
    
    print(json.dumps(results, indent=4, ensure_ascii=False))
    conn.close()

if __name__ == "__main__":
    logger.info("Starting data analysis...")
    main()
