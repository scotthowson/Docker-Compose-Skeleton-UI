#!/usr/bin/env bash
# Rasterise the Discord brand kit from the SVG sources (needs rsvg-convert).
set -euo pipefail
cd "$(dirname "$0")"
rsvg-convert -w 1024 -h 1024 app-icon.svg -o app-icon.png
rsvg-convert -w 1024 -h 1024 bot-avatar.svg -o bot-avatar.png
rsvg-convert -w 1024 -h 1024 webhook-avatar.svg -o webhook-avatar.png
rsvg-convert -w 1024 -h 1024 crowdsec-avatar.svg -o crowdsec-avatar.png
rsvg-convert -w 1024 -h 1024 app-icon.svg -o presence-dcs.png
rsvg-convert -w 512 -h 512 presence-healthy.svg -o presence-healthy.png
rsvg-convert -w 512 -h 512 presence-warning.svg -o presence-warning.png
rsvg-convert -w 1360 -h 480 bot-banner.svg -o bot-banner.png
ls -la *.png
