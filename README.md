# QQScrape

#### QQScrape is a web scraping and data visualization tool designed to scrape, analyze, and display music chart data from QQMusic.

## Overview

QQScrape is built with two primary components:

1. **Backend Scraper**

   - Utilizes **[Rain120's QQMusic API](https://github.com/Rain120/qq-music-api)** for data retrieval
        - Special thanks to Rain120 for developing this, as I found no other working APIs available in the US
   - Scrapes QQMusic charts, extracting song rankings, metadata, and streaming statistics
   - Standardizes and stores data in a **PostgreSQL** database via **Supabase**
   - Implements caching to reduce redundant API requests and improve efficiency

2. **Web Application**

   - Developed using **Next.js** and Supabase to display real-time and historical chart data
   - Features an interactive dashboard where users can look into chart movement, song longevity, and analytical trends
   - Implements dynamic search indexing and query optimization for the filtering and retrieval of large-scale data
   - Uses **Recharts** to visualize chart movement for a graphical perspective of song performance

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
