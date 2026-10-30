#!/usr/bin/env bash
# Builds the historical transport network (one PMTiles file): railroads,
# canals and steamboat-navigated rivers, each with the years it was in use,
# so a map set to a year draws that year's network (zoom 3-12).
#
# Source: Jeremy Atack's historical transportation GIS databases (Vanderbilt
# University): railroads 1826-1911, nineteenth-century canals, and
# steamboat-navigated rivers. Free to download with a suggested citation; no
# licence is stated. Railroads carry the year they were in operation by
# (`InOpBy`, from survey snapshots: 1830, 1835, 1840 ... 1861, 1863, 1868 ...)
# and never close; canals the years they opened and closed; rivers the years
# steamboats ran on them (2100 = still in use).
#
# It also measures how far each almanac record lay from the railroads, and
# from the canals and steamboat rivers, of its year (transport-distances.py),
# into transport-distances.json beside the tiles; the API reads it from the
# shared volume for its railroad statistics. Skipped without a database.
#
# Usage: build-transport.sh <out.pmtiles> [work-dir]
# Needs: curl, unzip, ogr2ogr (gdal), tippecanoe, python3 + shapely + pyproj,
# mysql client. Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-transport.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
BASE=${ATACK_URL:-https://cdn.vanderbilt.edu/t2-my/my-prd/wp-content/uploads/sites/133}
RAIL_ZIP=${RAIL_ZIP:-2024/09/RR1826-1911Modified103123.zip}
CANAL_ZIP=${CANAL_ZIP:-2017/03/19thC_Canals_March2017.zip}
RIVER_ZIP=${RIVER_ZIP:-2016/02/SteamboatNavigatedRiverContigUSAprojection.zip}

SRC="$WORK/src/atack"
D="$WORK/transport"
mkdir -p "$SRC" "$D"

# fetch <zip path>: download and unpack once; prints the shapefile's path
fetch() {
  local name; name=$(basename "$1" .zip)
  if [ ! -d "$SRC/$name" ]; then
    echo "[transport] downloading $name" >&2
    curl -fsSL --retry 3 -o "$SRC/$name.zip" "$BASE/$1"
    unzip -q -o "$SRC/$name.zip" -d "$SRC/$name"
    rm "$SRC/$name.zip"
  fi
  find "$SRC/$name" -name '*.shp' ! -path '*__MACOSX*' -print -quit
}

# export <shp> <out> <select> [ogr2ogr options]: one GeoJSON feature per line,
# properties from the SQL select (kind, name, from, to as yyyymmdd days, the
# same encoding as history.pmtiles, so map-vis filters them alike)
export_layer() {
  local shp=$1 out=$2 select=$3 layer
  shift 3
  layer=$(basename "$shp" .shp)
  ogr2ogr -f GeoJSONSeq -lco RS=NO "$@" -dialect sqlite \
    -sql "SELECT $select, Geometry FROM \"$layer\"" "$out" "$shp"
}

# a year y counts from 1 January; an end year counts to 31 December of the
# year before (2100 means still in use)
until_sql() { echo "CASE WHEN $1 >= 2100 OR $1 IS NULL THEN 99991231 ELSE ($1 - 1) * 10000 + 1231 END"; }

RAIL_SQL="'rail' AS kind, RRname AS name, InOpBy * 10000 + 101 AS \"from\", 99991231 AS \"to\""
CANAL_SQL="'canal' AS kind, NAME AS name, OPENED * 10000 + 101 AS \"from\", $(until_sql CLOSED) AS \"to\""
RIVER_SQL="'steamboat' AS kind, NAME AS name, START * 10000 + 101 AS \"from\", $(until_sql '"END"') AS \"to\""
for layer in rail:RAIL canals:CANAL rivers:RIVER; do
  name=${layer%%:*}; key=${layer##*:}
  zip_var="${key}_ZIP"; sql_var="${key}_SQL"
  shp=$(fetch "${!zip_var}")
  export_layer "$shp" "$D/$name.geojsonl" "${!sql_var}" -t_srs EPSG:4326
done

DIST="$(dirname "$OUT")/transport-distances.json"
if [ -n "${DB_HOST:-}" ]; then
  echo "[transport] measuring each record's distance to the railroads and waterways of its year"
  mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e \
    "SELECT ID, year, latitude, longitude FROM almanacRecords WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
    | python3 /tiles/transport-distances.py "$D/rail.geojsonl" "$D/canals.geojsonl" "$D/rivers.geojsonl" \
    > "$DIST.tmp"
  mv "$DIST.tmp" "$DIST"
  echo "[transport] wrote $DIST ($(du -h "$DIST" | cut -f1))"
else
  echo "[transport] no database configured: skipping the distances"
fi

echo "[transport] $(cat "$D"/*.geojsonl | wc -l) features → $OUT (z3–12)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs historical transport" \
  --description="Railroads, canals and steamboat-navigated rivers by year, from Jeremy Atack's historical transportation GIS (Vanderbilt); zoom 3-12" \
  --attribution="Historical transportation GIS, Jeremy Atack, Vanderbilt University" \
  --minimum-zoom=3 --maximum-zoom=12 \
  --layer=transport \
  --drop-rate=1 --no-feature-limit --no-tile-size-limit \
  --simplification=4 \
  --quiet \
  "$D/rail.geojsonl" "$D/canals.geojsonl" "$D/rivers.geojsonl"
mv "$OUT.tmp.pmtiles" "$OUT"
rm -f "$D"/*.geojsonl
echo "[transport] wrote $OUT ($(du -h "$OUT" | cut -f1))"
