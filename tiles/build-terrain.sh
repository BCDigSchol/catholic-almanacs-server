#!/usr/bin/env bash
# Builds the terrain (one PMTiles file of elevation tiles, zooms 0–10) over
# the lower 48, so the map can shade the land by its relief: the Rockies and
# the Sierra, the Appalachians, the flat Mississippi valley.
#
# The tiles are Mapzen/Tilezen's Terrain Tiles on AWS Open Data (bucket
# elevation-tiles-prod, "terrarium" encoding: height = R*256 + G + B/256 -
# 32768), built from U.S. 3DEP, SRTM and GMTED2010 elevation data, all works
# of the U.S. Geological Survey (public domain). The map shades them itself
# (a MapLibre raster-dem source and a hillshade layer), so one file serves
# both themes and any light direction.
#
# Downloads are kept in the work dir (one PNG per tile), so a rebuild only
# fetches what is missing; MAX_ZOOM (default 10) sets how far in the relief
# goes (each zoom is four times the tiles of the one before: about 1 GB in
# all at 10).
#
# Usage: build-terrain.sh <out.pmtiles> [work-dir]
# Needs: curl, python3, pmtiles (go-pmtiles).
set -euo pipefail

OUT=${1:?usage: build-terrain.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
MAX_ZOOM=${TERRAIN_MAX_ZOOM:-10}
SRC=${TERRAIN_TILES:-https://s3.amazonaws.com/elevation-tiles-prod/terrarium}
HERE=$(cd "$(dirname "$0")" && pwd)
# the lower 48, with a margin: west, south, east, north
BOX=${TERRAIN_BOX:--126,23.5,-65,50.5}

D="$WORK/terrain"
mkdir -p "$D/tiles"

echo "[terrain] listing the tiles over $BOX to zoom $MAX_ZOOM"
python3 "$HERE/terrain-tiles.py" list "$BOX" "$MAX_ZOOM" > "$D/tiles.txt"
total=$(wc -l < "$D/tiles.txt" | tr -d ' ')

# fetch what is missing, a few at a time, into z/x/y.png
echo "[terrain] fetching up to $total tiles from $SRC (those already here are kept)"
grep -v '^$' "$D/tiles.txt" | while read -r z x y; do
  f="$D/tiles/$z/$x/$y.png"
  [ -s "$f" ] || echo "$z $x $y"
done | xargs -P 16 -n 3 sh -c '
  z=$1; x=$2; y=$3; f="'"$D"'/tiles/$z/$x/$y.png"
  mkdir -p "$(dirname "$f")"
  for try in 1 2 3 4; do
    curl -fsS --retry 2 -o "$f.tmp" "'"$SRC"'/$z/$x/$y.png" && mv "$f.tmp" "$f" && exit 0
    sleep $((try * 2))
  done
  echo "[terrain] failed: $z/$x/$y" >&2; rm -f "$f.tmp"; exit 1
' sh

have=$(find "$D/tiles" -name '*.png' | wc -l | tr -d ' ')
echo "[terrain] $have tiles on disk; writing the archive"
python3 "$HERE/terrain-tiles.py" pack "$D/tiles" "$D/tiles.txt" "$D/terrain.mbtiles"
pmtiles convert "$D/terrain.mbtiles" "$OUT.tmp.pmtiles"
mv "$OUT.tmp.pmtiles" "$OUT"
rm -f "$D/terrain.mbtiles"
ls -l "$OUT"
