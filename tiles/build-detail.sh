#!/usr/bin/env bash
# Builds the street-level detail (one PMTiles file, zooms 10–15) around every
# place the almanacs record, so churches a few blocks apart can be told apart.
#
# The area is read from the database at build time: every recorded coordinate
# inside the US, snapped to a grid of CELL-degree cells and grown by MARGIN
# cells, so the detail follows the data (Alaska included once its records
# arrive). Inside it: streets and roads, railways, rivers, canals and water
# bodies, parks and cemeteries, from OpenStreetMap (ODbL, © OpenStreetMap
# contributors). No buildings or points of interest: the map stays quiet
# under the data.
#
# Disk: one raw state at a time (deleted once filtered); the filtered states
# stay in the work volume so rebuilds only redo the cut-out and the tiles.
#
# Usage: build-detail.sh <out.pmtiles> [work-dir]
# Needs: curl, jq, mysql client, python3 + shapely, osmium, tippecanoe.
# Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-detail.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
CELL=${CELL:-0.05}      # degrees; ~5 km
MARGIN=${MARGIN:-1}     # cells added on every side
GEOFABRIK_INDEX=${GEOFABRIK_INDEX:-https://download.geofabrik.de/index-v1.json}
HERE=$(cd "$(dirname "$0")" && pwd)

mkdir -p "$WORK/src" "$WORK/detail"
D="$WORK/detail"

# ── The area: grid cells holding recorded places ────────────────────────────
# Coordinates outside the US (lat 24–72, west of 65°W) are skipped: a few
# records carry swapped or mistyped values, and Hawaii is never in scope.
echo "[detail] reading recorded places from $DB_HOST/$DB_NAME"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e "
  SELECT DISTINCT FLOOR(latitude / $CELL), FLOOR(longitude / $CELL)
  FROM almanacRecords
  WHERE latitude BETWEEN 24 AND 72 AND longitude BETWEEN -180 AND -65" 2>/dev/null > "$D/cells.txt"
python3 "$HERE/make-area.py" "$CELL" "$MARGIN" < "$D/cells.txt" > "$D/area.geojson"

# ── OpenStreetMap: the states that hold recorded places, filtered ──────────
# Geofabrik's per-state extracts, only for the states the area touches. Each
# is downloaded, filtered to what the map draws, and deleted, so the build
# never holds more than one raw state (~1.3 GB at most) on disk; the filtered
# states are kept for later builds, so new places only fetch new states.
# Set REFRESH_OSM=1 to fetch fresh data for every state.
mkdir -p "$WORK/src/states"
if [ ! -s "$WORK/src/geofabrik-index.json" ] || [ -n "${REFRESH_OSM:-}" ]; then
  curl -fsSL --retry 3 -o "$WORK/src/geofabrik-index.json" "$GEOFABRIK_INDEX"
fi
python3 "$HERE/pick-regions.py" "$WORK/src/geofabrik-index.json" "$D/area.geojson" > "$D/states.txt"
echo "[detail] $(wc -l < "$D/states.txt" | tr -d ' ') states: $(cut -d' ' -f1 "$D/states.txt" | tr '\n' ' ')"

filtered=()
while read -r state url; do
  out="$WORK/src/states/$state.filtered.osm.pbf"
  if [ ! -s "$out" ] || [ -n "${REFRESH_OSM:-}" ]; then
    echo "[detail] $state: downloading and filtering" >&2
    curl -fsSL --retry 5 -o "$WORK/src/states/$state.osm.pbf" "$url"
    osmium tags-filter --overwrite -o "$out" "$WORK/src/states/$state.osm.pbf" \
      w/highway=motorway,trunk,primary,secondary,tertiary,unclassified,residential,living_street,pedestrian \
      w/railway=rail \
      w/waterway=river,canal,stream \
      nwr/natural=water \
      wr/leisure=park \
      wr/landuse=cemetery wr/amenity=grave_yard
    rm -f "$WORK/src/states/$state.osm.pbf"
  fi
  filtered+=("$out")
done < "$D/states.txt"

echo "[detail] merging ${#filtered[@]} filtered states"
osmium merge --overwrite -o "$D/us-filtered.osm.pbf" "${filtered[@]}"

echo "[detail] cutting out the recorded places' area"
# smart: keeps multipolygons whole (a river bank cut at the area edge would
# otherwise be dropped as an incomplete area)
osmium extract --overwrite -s smart -p "$D/area.geojson" -o "$D/area.osm.pbf" "$D/us-filtered.osm.pbf"
osmium export --overwrite -f geojsonseq -x print_record_separator=false \
  --geometry-types=linestring,polygon -o "$D/area.geojsonl" "$D/area.osm.pbf"

# ── Features for the tiles ──────────────────────────────────────────────────
# One small property set per feature and the zoom it first appears at:
# main roads and rivers at 10 (motorways are their own kind, so the style can
# keep the twentieth century's highways quiet), secondary roads and rail at 11, streets, parks
# and cemeteries at 12, streams at 13.
echo "[detail] preparing features"
jq -c '
  .geometry as $g | .properties as $p
  | ($g.type | test("Polygon")) as $area
  | (if ($p.highway != null) and ($area | not) then
       ($p.highway) as $h
       | (if ($h == "motorway" or $h == "trunk") then {kind: "motorway", z: 10}
          elif $h == "primary" then {kind: "major", z: 10}
          elif ($h == "secondary" or $h == "tertiary") then {kind: "secondary", z: 11}
          else {kind: "minor", z: 12} end)
       | {layer: "roads", z, props: {kind, name: $p.name}}
     elif ($p.railway == "rail") and ($area | not) and ($p.tunnel == null) then
       {layer: "rail", z: 11, props: {}}
     elif ($p.waterway != null) and ($area | not) then
       {layer: "waterways", z: (if $p.waterway == "stream" then 13 else 10 end),
        props: {kind: $p.waterway, name: $p.name}}
     elif ($p.natural == "water") and $area then
       {layer: "water", z: 10, props: {name: $p.name}}
     elif ($p.landuse == "cemetery" or $p.amenity == "grave_yard") and $area then
       {layer: "green", z: 12, props: {kind: "cemetery", name: $p.name}}
     elif ($p.leisure == "park") and $area then
       {layer: "green", z: 12, props: {kind: "park", name: $p.name}}
     else null end)
  | select(. != null)
  | {type: "Feature", geometry: $g, properties: (.props | with_entries(select(.value != null))),
     tippecanoe: {layer, minzoom: .z}}
' "$D/area.geojsonl" > "$D/features.geojsonl"

echo "[detail] $(wc -l < "$D/features.geojsonl") features → $OUT (z10–15)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs street detail" \
  --description="Streets, rail, water, parks and cemeteries around recorded places; zoom 10-15" \
  --attribution="© OpenStreetMap contributors" \
  --minimum-zoom=10 --maximum-zoom=15 \
  --read-parallel \
  --drop-densest-as-needed \
  --detect-shared-borders \
  "$D/features.geojsonl"
mv "$OUT.tmp.pmtiles" "$OUT"
# the intermediates are several GB and rebuilt every time; the filtered states stay
rm -f "$D/us-filtered.osm.pbf" "$D/area.osm.pbf" "$D/area.geojsonl" "$D/features.geojsonl"
ls -l "$OUT"
