#!/bin/sh
# Usage: shoot.sh name route width height [query]
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
BASE="file:///$ROOT/index.html"
OUT="$ROOT/shots"
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot="$OUT/$1.png" --window-size=$3,$4 "$BASE$5#$2" >/dev/null 2>&1
echo "$1 done"
