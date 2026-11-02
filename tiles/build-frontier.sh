#!/usr/bin/env bash
# Builds the post offices (one PMTiles file of points, zooms 3–12, each with
# the years it was open) and, with the database, each record's measures
# against the post offices open in its year (frontier.json beside the tiles,
# read by the API for the Frontier dashboard): the distance to the nearest
# one, when that one opened, and how many stood within 25 miles; and, per
# year, the open offices with no Catholic institution within 25 miles and, where
# the counties build has left its outlines in the work dir, each county's post
# offices per 100 square miles (run `tiles-build counties` first for that).
#
# A post office is the closest thing to a year-by-year record of where people
# had settled. The data is Blevins and Helbock, "US Post Offices" (Harvard
# Dataverse, 2021, doi:10.7910/DVN/NUKCNA, CC0): 166,140 offices 1639–2000
# with the year each opened and closed and, for two in three, a location
# matched to GNIS. The download is kept in the work dir.
#
# Usage: build-frontier.sh <out.pmtiles> [work-dir]
# Needs: curl, python3 + shapely + pyproj + numpy, tippecanoe; the mysql
# client for the measures. Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-frontier.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
HERE=$(cd "$(dirname "$0")" && pwd)
SRC_URL=${POST_OFFICES_URL:-"https://dataverse.harvard.edu/api/access/datafile/4491713?format=original"}

D="$WORK/frontier"
mkdir -p "$D" "$WORK/src"
CSV="$WORK/src/us-post-offices.csv"
if [ ! -s "$CSV" ] || [ -n "${REFRESH_POST_OFFICES:-}" ]; then
  echo "[frontier] downloading the post offices" >&2
  curl -fsSL --retry 3 -o "$CSV.tmp" "$SRC_URL" && mv "$CSV.tmp" "$CSV"
fi

echo "[frontier] preparing features"
python3 "$HERE/frontier-features.py" "$CSV" > "$D/features.geojsonl"

MEASURES="$(dirname "$OUT")/frontier.json"
if [ -n "${DB_HOST:-}" ]; then
  echo "[frontier] measuring each record against the post offices of its year"
  mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e \
    "SELECT ID, year, latitude, longitude FROM almanacRecords WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
    | python3 "$HERE/frontier-measures.py" "$D/features.geojsonl" $( [ -s "$WORK/counties/counties.geojsonl" ] && echo "$WORK/counties/counties.geojsonl" ) > "$MEASURES.tmp"
  mv "$MEASURES.tmp" "$MEASURES"
  echo "[frontier] wrote $MEASURES ($(du -h "$MEASURES" | cut -f1))"
else
  echo "[frontier] no database configured: skipping the measures"
fi

echo "[frontier] $(wc -l < "$D/features.geojsonl" | tr -d ' ') post offices → $OUT (z3–12)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs post offices" \
  --description="US post offices with the years each was open (Blevins and Helbock, CC0), zoom 3-12" \
  --attribution="Post offices: Cameron Blevins and Richard W. Helbock, US Post Offices (CC0)" \
  --layer=postoffices \
  --minimum-zoom=3 --maximum-zoom=12 \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --quiet \
  "$D/features.geojsonl"
mv "$OUT.tmp.pmtiles" "$OUT"
rm -f "$D/features.geojsonl"
ls -l "$OUT"
