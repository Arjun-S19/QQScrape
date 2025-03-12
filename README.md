# QQScrape

## Overview

QQScrape is a web scraping and data visualization tool designed to extract, analyze, and present music chart data from QQMusic. It consists of a backend scraper and a web application that provides a user-friendly interface for interacting with the collected data.

## How It Works

QQScrape is built with two primary components:

1. **Backend Scraper**

   - Utilizes **[Rain120's QQMusic API](https://github.com/Rain120/qq-music-api)** for efficient data retrieval. 
        - Special thanks to Rain120 for developing this, as I found no other working APIs available in the US.
   - Uses web scraping techniques to extract song rankings, metadata, and streaming statistics.
   - Stores data in a structured format for further analysis.

2. **Web Application**

   - Developed using **Next.js** and **Supabase** to display real-time and historical chart data.
   - Features an interactive dashboard where users can explore ranking trends, song longevity, and comparative analysis.
   - Implements search and filtering functionalities to easily navigate large datasets.
   - Uses **Recharts** for data visualization, enabling users to view trends over time.

### Data Collection

- Fetches chart listings and identifies song metadata, including title, artist, ranking, and stream count (if available), using Rain120's QQMusic API.
- Collects data at regular intervals to monitor ranking fluctuations over time.
- Ensures consistency in extracted metadata for accurate tracking and analysis.

### Data Processing

- **Validation & Normalization:** Cleans extracted data to maintain consistency across different chart formats.
- **Duplicate Handling:** Detects and removes redundant entries to prevent unnecessary data storage.
- **Historical Data Archiving:** Stores past chart data for long-term comparison and trend analysis.
- **Database Storage:** Uses PostgreSQL via Supabase for efficient querying and retrieval.
- **Caching Mechanism:** Optimizes API calls by storing and reusing previously retrieved song metadata, reducing redundant requests.

### Analysis & Insights

- **Ranking Trends:** Tracks song movement over time to identify emerging trends in the QQMusic ecosystem.
- **Longevity Analysis:** Measures how long a song remains in the charts and its ranking trajectory.
- **Breakout Detection:** Identifies rapidly rising tracks gaining popularity.
- **Performance Summaries:** Highlights the most stable, fastest-rising, and longest-lasting songs.
- **Chart Comparisons:** Compares ranking fluctuations across multiple QQMusic charts to determine crossover success.
- **API Access:** Provides structured API endpoints for seamless integration with OVG! Media’s proprietary systems.

## Purpose

QQScrape is developed exclusively for **[OVG! Media](https://www.ovgmedia.com/)** as a proprietary tool. By automating data collection and providing structured insights, QQScrape streamlines QQMusic chart tracking and analysis for OVG! Media.

## License

### Proprietary License

Copyright (C) 2025 OVG! Media. All rights reserved.

This software and its contents (collectively, "QQScrape") are proprietary to OVG! Media and may not be copied, modified, distributed, or used in any form without explicit written permission from OVG! Media.

By accessing or using QQScrape, you agree to the following terms:

- **No Redistribution or Commercial Use:** You may not redistribute, sublicense, sell, or otherwise use QQScrape for any commercial purpose.
- **No Modification or Derivative Works:** You may not modify, reverse engineer, decompile, disassemble, or create derivative works based on QQScrape.
- **Limited Usage:** Access to QQScrape is granted solely for the intended purposes designated by OVG! Media.
- **No Warranty:** This software is provided "as is" without any warranties or guarantees of any kind.
- **Enforcement:** OVG! Media reserves the right to take legal action against any unauthorized use, distribution, or modification of QQScrape.

For inquiries about licensing, please contact OVG! Media at [contact@ovgmedia.com](mailto:contact@ovgmedia.com).