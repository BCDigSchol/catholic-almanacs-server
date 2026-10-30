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
# Usage: build-transport.sh <out.pmtiles> [work-dir]
# Needs: curl, unzip, ogr2ogr (gdal), tippecanoe.
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

# export <shp> <out> <select>: reprojected to WGS 84, one GeoJSON feature per
# line, properties from the SQL select (kind, name, from, to as yyyymmdd days,
# the same encoding as history.pmtiles, so map-vis filters them alike)
export_layer() {
  local shp=$1 out=$2 select=$3 layer
  layer=$(basename "$shp" .shp)
  ogr2ogr -f GeoJSONSeq -lco RS=NO -t_srs EPSG:4326 -dialect sqlite \
    -sql "SELECT $select, Geometry FROM \"$layer\"" "$out" "$shp"
}

# a year y counts from 1 January; an end year counts to 31 December of the
# year before (2100 means still in use)
until_sql() { echo "CASE WHEN $1 >= 2100 OR $1 IS NULL THEN 99991231 ELSE ($1 - 1) * 10000 + 1231 END"; }

export_layer "$(fetch "$RAIL_ZIP")" "$D/rail.geojsonl" \
  "'rail' AS kind, RRname AS name, InOpBy * 10000 + 101 AS \"from\", 99991231 AS \"to\""
export_layer "$(fetch "$CANAL_ZIP")" "$D/canals.geojsonl" \
  "'canal' AS kind, NAME AS name, OPENED * 10000 + 101 AS \"from\", $(until_sql CLOSED) AS \"to\""
export_layer "$(fetch "$RIVER_ZIP")" "$D/rivers.geojsonl" \
  "'steamboat' AS kind, NAME AS name, START * 10000 + 101 AS \"from\", $(until_sql '"END"') AS \"to\""

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
