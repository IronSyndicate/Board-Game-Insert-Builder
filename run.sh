#!/usr/bin/env bash
# BIT Builder launcher for macOS / Linux
cd "$(dirname "$0")"
pip install -q -r requirements.txt
( sleep 1; xdg-open http://127.0.0.1:5000 2>/dev/null || open http://127.0.0.1:5000 ) &
python3 app.py
