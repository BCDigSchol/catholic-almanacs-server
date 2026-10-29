#!/usr/bin/env bash
# Builds the historical streets (one PMTiles file): streets and railways from
# OpenHistoricalMap, each with the dates it existed, so a map set to a year
# can draw that year's streets (zoom 10-15) over today's.
#
# Source: the OpenHistoricalMap planet (CC0; © OpenHistoricalMap
# contributors), the newest daily snapshot, cut to the United States. Coverage
# is what volunteers have mapped: thorough in some cities (lower Manhattan,
# Cincinnati), thin in most.
#
# Usage: build-ohm.sh <out.pmtiles> [work-dir]
# Needs: curl, osmium, python3, tippecanoe.
set -euo pipefail

OUT=${1:?usage: build-ohm.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
# the bucket lists the snapshots; the files themselves come through the CDN
BUCKET=${OHM_BUCKET:-https://s3.amazonaws.com/planet.openhistoricalmap.org}
PLANET_URL=${OHM_PLANET_URL:-https://planet.openhistoricalmap.org}
# the US (Alaska included, Hawaii below the box): west,south,east,north
BBOX=${OHM_BBOX:--180,24,-65,72}

D="$WORK/ohm"
mkdir -p "$D"

# the newest daily planet: list the last month's snapshots and take the last
since=$(date -u -d '-30 days' +%y%m%d)
PLANET=$(curl -fsS --retry 3 "$BUCKET?list-type=2&prefix=planet/&start-after=planet/planet-$since" \
  | grep -o '<Key>planet/planet-[0-9_]*\.osm\.pbf</Key>' | sed 's/<[^>]*>//g' | sort | tail -1)
[ -n "$PLANET" ] || { echo "[ohm] no planet snapshot found in the last 30 days" >&2; exit 1; }
SNAPSHOT=$(basename "$PLANET" .osm.pbf)

# filtered once per snapshot: the raw planet (~1.3 GB) is deleted straight away
FILTERED="$D/$SNAPSHOT.us.osm.pbf"
if [ ! -s "$FILTERED" ]; then
  echo "[ohm] downloading $PLANET" >&2
  curl -fsSL --retry 3 -o "$D/planet.osm.pbf" "$PLANET_URL/$PLANET"
  osmium tags-filter --overwrite -o "$D/filtered.osm.pbf" "$D/planet.osm.pbf" w/highway w/railway
  rm "$D/planet.osm.pbf"
  osmium extract --overwrite -s smart -b "$BBOX" -o "$FILTERED.tmp.osm.pbf" "$D/filtered.osm.pbf"
  rm "$D/filtered.osm.pbf"
  mv "$FILTERED.tmp.osm.pbf" "$FILTERED"
  find "$D" -name '*.us.osm.pbf' ! -name "$SNAPSHOT.us.osm.pbf" -delete   # older snapshots
fi

osmium export -f geojsonseq -x print_record_separator=false --geometry-types=linestring \
  --overwrite -o "$D/ohm.geojsonl" "$FILTERED"
python3 /tiles/ohm-features.py < "$D/ohm.geojsonl" > "$D/features.geojsonl"
rm "$D/ohm.geojsonl"

echo "[ohm] $(wc -l < "$D/features.geojsonl") features from $SNAPSHOT → $OUT (z10–15)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs historical streets" \
  --description="OpenHistoricalMap streets and railways with their dates, United States, snapshot $SNAPSHOT; zoom 10-15" \
  --attribution="© OpenHistoricalMap contributors" \
  --minimum-zoom=10 --maximum-zoom=15 \
  --read-parallel \
  --drop-densest-as-needed \
  --quiet \
  "$D/features.geojsonl"
mv "$OUT.tmp.pmtiles" "$OUT"
rm "$D/features.geojsonl"
echo "[ohm] wrote $OUT ($(du -h "$OUT" | cut -f1))"
