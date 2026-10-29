#!/usr/bin/env bash
# Builds the historical boundaries (one PMTiles file): every US state and
# territory as it stood on any day from 1783 to 2000, so a map set to an
# almanac year can draw that year's lines instead of today's.
#
# Source: the Atlas of Historical County Boundaries, US states and territories
# (© The Newberry Library, CC BY-NC-SA 2.5), generalized to 0.0001°
# (about 10 m). Each feature is one version of a state or territory with the
# dates it was in force; the map filters on them (see history-features.py).
#
# Usage: build-history.sh <out.pmtiles> [work-dir]
# Needs: curl, unzip, ogr2ogr (gdal), python3 + shapely, tippecanoe.
set -euo pipefail

OUT=${1:?usage: build-history.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
AHCB_URL=${AHCB_URL:-https://publications.newberry.org/ahcb/downloads/gis/US_AtlasHCB_StateTerr_Gen0001.zip}

SRC="$WORK/src/ahcb-states"
mkdir -p "$SRC"
if [ -z "$(find "$SRC" -name '*.shp' -print -quit)" ]; then
  echo "[history] downloading the Newberry states and territories" >&2
  curl -fsSL --retry 3 -o "$SRC/states.zip" "$AHCB_URL"
  unzip -q -o "$SRC/states.zip" -d "$SRC"
  rm "$SRC/states.zip"
fi
SHP=$(find "$SRC" -name '*.shp' -print -quit)

FEATURES="$WORK/history.geojsonl"
ogr2ogr -f GeoJSONSeq -lco RS=NO -t_srs EPSG:4326 -select NAME,FULL_NAME,TERR_TYPE,START_N,END_N /vsistdout/ "$SHP" \
  | python3 /tiles/history-features.py > "$FEATURES"

echo "[history] $(wc -l < "$FEATURES") features → $OUT (z0–10)"
mkdir -p "$(dirname "$OUT")"
# shared borders simplify identically, so neighbours' outlines stay one line
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs historical boundaries" \
  --description="US states and territories by date, 1783-2000 (Hawaii excluded); zoom 0-10" \
  --attribution="Atlas of Historical County Boundaries, The Newberry Library" \
  --minimum-zoom=0 --maximum-zoom=10 \
  --drop-rate=1 --detect-shared-borders --no-tiny-polygon-reduction \
  --no-feature-limit --no-tile-size-limit \
  --quiet \
  "$FEATURES"
mv "$OUT.tmp.pmtiles" "$OUT"
rm -f "$FEATURES"
echo "[history] wrote $OUT ($(du -h "$OUT" | cut -f1))"
