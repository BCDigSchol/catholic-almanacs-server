#!/usr/bin/env bash
# Suggests present-day places (and their websites) for the almanacs'
# institutions: Catholic churches, schools, colleges, hospitals and convents
# from OpenStreetMap (ODbL, © OpenStreetMap contributors), matched by
# dedication and distance (record-links.py). Writes link-candidates.json beside
# the tiles, which the API reads for the Data Issues review; nothing is linked
# until a person confirms it there.
#
# The places come from Geofabrik's per-state extracts, the states the detail
# build uses (those holding recorded places). Each state's churches, schools,
# colleges, hospitals and monasteries are kept in the work dir
# (src/states/<state>.places.osm.pbf), so later runs only match; the detail
# build writes the same file when it downloads a state, and REFRESH_OSM=1
# fetches every state again. One raw state on disk at a time.
#
# Usage: build-links.sh <out.json> [work-dir]
# Needs: curl, osmium, python3 + shapely, the mysql client. Database: DB_HOST,
# DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-links.sh <out.json> [work-dir]}
WORK=${2:-$(mktemp -d)}
CELL=${CELL:-0.05}
MARGIN=${MARGIN:-1}
GEOFABRIK_INDEX=${GEOFABRIK_INDEX:-https://download.geofabrik.de/index-v1.json}
HERE=$(cd "$(dirname "$0")" && pwd)
if [ -z "${DB_HOST:-}" ]; then echo "[links] needs the database (DB_HOST)" >&2; exit 1; fi
DB=(mysql --default-character-set=utf8mb4 -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B)

D="$WORK/links"
mkdir -p "$D" "$WORK/src/states"

# the states holding recorded places, as the detail build picks them
"${DB[@]}" -e "SELECT DISTINCT FLOOR(latitude / $CELL), FLOOR(longitude / $CELL) FROM almanacRecords
               WHERE latitude BETWEEN 24 AND 72 AND longitude BETWEEN -180 AND -65" 2>/dev/null > "$D/cells.txt"
python3 "$HERE/make-area.py" "$CELL" "$MARGIN" < "$D/cells.txt" > "$D/area.geojson"
if [ ! -s "$WORK/src/geofabrik-index.json" ] || [ -n "${REFRESH_OSM:-}" ]; then
  curl -fsSL --retry 3 -o "$WORK/src/geofabrik-index.json" "$GEOFABRIK_INDEX"
fi
python3 "$HERE/pick-regions.py" "$WORK/src/geofabrik-index.json" "$D/area.geojson" > "$D/states.txt"

places=()
while read -r state url; do
  out="$WORK/src/states/$state.places.osm.pbf"
  if [ ! -s "$out" ] || [ -n "${REFRESH_OSM:-}" ]; then
    echo "[links] $state: downloading" >&2
    curl -fsSL --retry 5 -o "$WORK/src/states/$state.osm.pbf" "$url"
    bash "$HERE/filter-places.sh" "$WORK/src/states/$state.osm.pbf" "$out"
    rm -f "$WORK/src/states/$state.osm.pbf"
  fi
  places+=("$out")
done < "$D/states.txt"

echo "[links] $(wc -l < "$D/states.txt" | tr -d ' ') states; exporting their places"
osmium merge --overwrite -o "$D/places.osm.pbf" "${places[@]}"
osmium export --overwrite -f geojsonseq -x print_record_separator=false --attributes=type,id \
  -o "$D/places.geojsonl" "$D/places.osm.pbf"

echo "[links] matching the institutions"
"${DB[@]}" -e "SELECT instID, year, instName, instType, latitude, longitude FROM almanacRecords
               WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
  | python3 "$HERE/record-links.py" "$D/places.geojsonl" "$(date -r "${places[0]}" +%Y-%m-%d)" > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
rm -f "$D/places.osm.pbf" "$D/places.geojsonl"
ls -l "$OUT"
