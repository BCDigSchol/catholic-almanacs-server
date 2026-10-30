#!/usr/bin/env bash
# Builds the diocese territories by year (one PMTiles file), and places every
# almanac record in the territory of its year (diocese-territories.json beside
# the tiles, read by the API).
#
# Source: dioceses/DioceseEachYear.zip, diocese boundaries drawn at Boston
# College (a work in progress: fuller in the east, and only some years), and
# dioceses/names.csv, which ties each shape to a diocese id
# (dioceses/match-names.py). A map shows them only when asked (map-vis
# [dioceses]).
#
# Usage: build-dioceses.sh <out.pmtiles> [work-dir]
# Needs: unzip, ogr2ogr (gdal), python3 + shapely, tippecanoe; the mysql client
# for the record check. Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-dioceses.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
SRC_ZIP=${DIOCESES_ZIP:-/tiles/dioceses/DioceseEachYear.zip}

D="$WORK/dioceses"
rm -rf "$D" && mkdir -p "$D"
unzip -q -o "$SRC_ZIP" -d "$D"
SHP=$(find "$D" -name '*.shp' -print -quit)

FEATURES="$D/features.geojsonl"
TERRITORIES="$D/territories.geojsonl"
ogr2ogr -f GeoJSONSeq -lco RS=NO -t_srs EPSG:4326 -lco COORDINATE_PRECISION=6 \
    -select DioceseNam,AlmanacYea,GlobalID /vsistdout/ "$SHP" \
  | python3 /tiles/dioceses-features.py /tiles/dioceses/names.csv /tiles/dioceses/labels.csv "$TERRITORIES" \
  > "$FEATURES"

CHECK="$(dirname "$OUT")/diocese-territories.json"
if [ -n "${DB_HOST:-}" ]; then
  echo "[dioceses] placing each record in the territory of its year"
  mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e \
    "SELECT ID, year, latitude, longitude FROM almanacRecords WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
    | python3 /tiles/diocese-territories.py "$TERRITORIES" > "$CHECK.tmp"
  mv "$CHECK.tmp" "$CHECK"
  echo "[dioceses] wrote $CHECK ($(du -h "$CHECK" | cut -f1))"
else
  echo "[dioceses] no database configured: skipping the record check"
fi

echo "[dioceses] $(wc -l < "$FEATURES") features → $OUT (z0–10)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs diocese territories" \
  --description="Diocese territories by year (in progress: fuller in the east, some years); zoom 0-10" \
  --attribution="Diocese territories: Catholic Almanacs project, Boston College (in progress)" \
  --minimum-zoom=0 --maximum-zoom=10 \
  --drop-rate=1 --detect-shared-borders --no-tiny-polygon-reduction \
  --no-feature-limit --no-tile-size-limit \
  --quiet \
  "$FEATURES"
mv "$OUT.tmp.pmtiles" "$OUT"
echo "[dioceses] wrote $OUT ($(du -h "$OUT" | cut -f1))"
