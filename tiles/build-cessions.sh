#!/usr/bin/env bash
# Builds the Indian land cessions (one PMTiles file), each area with the date
# its treaty was signed, so a map set to a year can show the land ceded before
# it apart from the land still held; and places every almanac record in the
# cession(s) it lies in (record-cessions.json beside the tiles, read by the API).
#
# Source: "Tribal Lands Ceded to the United States", U.S. Forest Service,
# Office of Tribal Relations (CC BY 4.0), digitised from Charles C. Royce,
# Indian Land Cessions in the United States (Bureau of American Ethnology,
# 18th Annual Report, 1899). For information only: not for title or legal
# boundaries; not reviewed by the National NAGPRA Program.
#
# Usage: build-cessions.sh <out.pmtiles> [work-dir]
# Needs: curl, python3 + shapely, tippecanoe; the mysql client for placing
# records. Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-cessions.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
URL=${CESSIONS_URL:-https://data-usfs.hub.arcgis.com/api/download/v1/items/e4e788be8cfc4d1f8ff280a81ffaa69c/geojson?layers=0}

SRC="$WORK/src/cessions"
mkdir -p "$SRC"
if [ ! -s "$SRC/cessions.geojson" ]; then
  echo "[cessions] downloading the Forest Service's land cessions (8 MB)" >&2
  curl -fsSL --retry 3 -o "$SRC/cessions.geojson.tmp" "$URL"
  mv "$SRC/cessions.geojson.tmp" "$SRC/cessions.geojson"
fi

D="$WORK/cessions"
mkdir -p "$D"
FEATURES="$D/features.geojsonl"
AREAS="$D/areas.geojsonl"
python3 /tiles/cessions-features.py "$AREAS" < "$SRC/cessions.geojson" > "$FEATURES"

PLACED="$(dirname "$OUT")/record-cessions.json"
if [ -n "${DB_HOST:-}" ]; then
  echo "[cessions] placing each record in the cession(s) it lies in"
  mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e \
    "SELECT ID, year, latitude, longitude FROM almanacRecords WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
    | python3 /tiles/record-cessions.py "$AREAS" > "$PLACED.tmp"
  mv "$PLACED.tmp" "$PLACED"
  echo "[cessions] wrote $PLACED ($(du -h "$PLACED" | cut -f1))"
else
  echo "[cessions] no database configured: skipping placing the records"
fi

echo "[cessions] $(wc -l < "$FEATURES") features → $OUT (z2–10)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs Indian land cessions" \
  --description="Indian land cessions in the United States, 1784-1894, after Royce (1899); zoom 2-10" \
  --attribution="Tribal Lands Ceded to the United States, U.S. Forest Service (CC BY 4.0), after C. C. Royce (1899)" \
  --minimum-zoom=2 --maximum-zoom=10 \
  --drop-rate=1 --no-tiny-polygon-reduction --coalesce-densest-as-needed \
  --no-feature-limit --no-tile-size-limit \
  --quiet \
  "$FEATURES"
mv "$OUT.tmp.pmtiles" "$OUT"
echo "[cessions] wrote $OUT ($(du -h "$OUT" | cut -f1))"
