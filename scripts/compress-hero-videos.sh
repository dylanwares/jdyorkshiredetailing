#!/usr/bin/env bash
# Compress the hero clips in assets/ into public/videos/. Originals are never modified,
# so re-run with different sizes any time (or delete public/videos/hero-* to revert).
#
#   FFMPEG=/path/to/ffmpeg scripts/compress-hero-videos.sh [desktop_MB] [mobile_MB]
#
# Afterwards run "node scripts/make-brand-images.mjs" to refresh the WebP poster the page uses.
#
# Clips are read in order: "hero bg.mp4", "hero bg2.mp4", "hero bg3.mp4", "hero bg 4.mp4" ...
set -euo pipefail
cd "$(dirname "$0")/.."

FFMPEG="${FFMPEG:-ffmpeg}"
DESKTOP_MB="${1:-2}"
MOBILE_MB="${2:-1}"
SOURCES=("assets/hero bg.mp4" "assets/hero bg2.mp4" "assets/hero bg3.mp4" "assets/hero bg 4.mp4")
OUT=public/videos
mkdir -p "$OUT"

duration() { { "$FFMPEG" -hide_banner -i "$1" 2>&1 || true; } | awk -F'[:, ]+' '/Duration/ {print $3*3600+$4*60+$5}'; }

encode() { # src out height size_mb
  local src="$1" out="$2" height="$3" mb="$4" dur kbps
  dur=$(duration "$src")
  kbps=$(awk -v mb="$mb" -v d="$dur" 'BEGIN {printf "%d", mb*8*1000/d*0.95}')
  local common=(-y -hide_banner -loglevel error -i "$src" -an -vf "scale=-2:$height,fps=30" -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v "${kbps}k" -maxrate "$((kbps*3/2))k" -bufsize "$((kbps*2))k")
  "$FFMPEG" "${common[@]}" -pass 1 -passlogfile "$out.log" -f mp4 /dev/null
  "$FFMPEG" "${common[@]}" -pass 2 -passlogfile "$out.log" -movflags +faststart "$out"
  rm -f "$out.log"*
  printf '%s  %s kbps  %s bytes\n' "$out" "$kbps" "$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")"
}

i=1
for src in "${SOURCES[@]}"; do
  encode "$src" "$OUT/hero-$i.mp4" 1080 "$DESKTOP_MB"
  encode "$src" "$OUT/hero-$i-mobile.mp4" 720 "$MOBILE_MB"
  i=$((i+1))
done

# Poster: first frame of clip 1, shown while the video loads
"$FFMPEG" -y -hide_banner -loglevel error -i "${SOURCES[0]}" -frames:v 1 -vf scale=1280:-2 -q:v 4 "$OUT/hero-poster.jpg"
ls -la "$OUT"
