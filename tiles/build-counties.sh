#!/usr/bin/env bash
# Builds the historical counties (one PMTiles file): every county as it stood
# on any day from 1830 to 1875, so a map set to an almanac year can draw that
# year's county lines; and places every almanac record in its county of that
# year (record-counties.json beside the tiles, read by the API).
#
# Source: the Atlas of Historical County Boundaries, US historical counties
# (© The Newberry Library, CC BY-NC-SA 2.5), generalized to 0.001° (about
# 100 m). The download's zip directory has wrong offsets, so it is unpacked by
# unzip-lenient.py, which checks every file's checksum.
#
# Usage: build-counties.sh <out.pmtiles> [work-dir]
# Needs: curl, ogr2ogr (gdal), python3 + shapely, tippecanoe; the mysql client
# for placing records. Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-counties.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
AHCB_URL=${AHCB_COUNTIES_URL:-https://publications.newberry.org/ahcb/downloads/gis/US_AtlasHCB_Counties_Gen001.zip}
# the years the almanacs cover, with a margin
FROM=18300101 TO=18751231

SRC="$WORK/src/ahcb-counties"
mkdir -p "$SRC"
if [ -z "$(find "$SRC" -name '*.shp' -print -quit)" ]; then
  echo "[counties] downloading the Newberry historical counties (52 MB)" >&2
  curl -fsSL --retry 3 -o "$SRC/counties.zip" "$AHCB_URL"
  python3 /tiles/unzip-lenient.py "$SRC/counties.zip" "$SRC"
  rm "$SRC/counties.zip"
fi
SHP=$(find "$SRC" -name '*.shp' -print -quit)

D="$WORK/counties"
mkdir -p "$D"
FEATURES="$D/features.geojsonl"
OUTLINES="$D/counties.geojsonl"
ogr2ogr -f GeoJSONSeq -lco RS=NO -t_srs EPSG:4326 -lco COORDINATE_PRECISION=5 \
    -where "END_N >= $FROM AND START_N <= $TO" \
    -select ID,NAME,FULL_NAME,STATE_TERR,CNTY_TYPE,START_N,END_N /vsistdout/ "$SHP" \
  | python3 /tiles/counties-features.py "$OUTLINES" > "$FEATURES"

PLACED="$(dirname "$OUT")/record-counties.json"
if [ -n "${DB_HOST:-}" ]; then
  echo "[counties] placing each record in its county of that year"
  mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e \
    "SELECT ID, year, latitude, longitude FROM almanacRecords WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
    | python3 /tiles/record-counties.py "$OUTLINES" > "$PLACED.tmp"
  mv "$PLACED.tmp" "$PLACED"
  echo "[counties] wrote $PLACED ($(du -h "$PLACED" | cut -f1))"
else
  echo "[counties] no database configured: skipping placing the records"
fi

echo "[counties] $(wc -l < "$FEATURES") features → $OUT (z4–10)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs historical counties" \
  --description="US counties by date, 1830-1875 (Hawaii excluded); zoom 4-10" \
  --attribution="Atlas of Historical County Boundaries, The Newberry Library" \
  --minimum-zoom=4 --maximum-zoom=10 \
  --drop-rate=1 --detect-shared-borders --no-tiny-polygon-reduction \
  --no-feature-limit --no-tile-size-limit \
  --quiet \
  "$FEATURES"
mv "$OUT.tmp.pmtiles" "$OUT"
rm -f "$FEATURES"
echo "[counties] wrote $OUT ($(du -h "$OUT" | cut -f1))"
