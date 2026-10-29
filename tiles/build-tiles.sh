#!/usr/bin/env bash
# Builds the North American base map (one PMTiles file) from open data.
#
# The almanacs cover the United States (Alaska included, Hawaii never), so the
# tiles are clipped to North America with Hawaii cut out; Canada, Mexico and the
# Caribbean stay as faint context so the continent reads whole. This file is
# the low-zoom base (z0–10): land, the US–Canada / US–Mexico borders, US state
# lines and names, rivers, lakes, sea names, cities and towns. Street-level
# detail around recorded places is a separate, later layer.
#
# Sources: Natural Earth 10m (public domain) at the low zooms, including its
# North America supplements for rivers and lakes; from DETAIL_ZOOM the
# coastline comes from OpenStreetMap's simplified land polygons (ODbL,
# © OpenStreetMap contributors) and the towns from GeoNames cities1000
# (CC BY 4.0).
#
# Usage: build-tiles.sh <out.pmtiles> [work-dir]
# Needs: curl, jq, unzip, ogr2ogr (gdal), tippecanoe (>= 2.17, writes PMTiles directly).
set -euo pipefail

OUT=${1:?usage: build-tiles.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
MAX_ZOOM=${MAX_ZOOM:-10}
# zoom from which the detailed coastline and the GeoNames towns take over
DETAIL_ZOOM=${DETAIL_ZOOM:-7}
NE_BASE=${NE_BASE:-https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson}
OSM_LAND_URL=${OSM_LAND_URL:-https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip}
GEONAMES_URL=${GEONAMES_URL:-https://download.geonames.org/export/dump/cities1000.zip}

# North America, west to the antimeridian (Alaska and the Aleutians as far as
# 180°), with a hole where Hawaii is.
CLIP='POLYGON((-180 14,-50 14,-50 75,-180 75,-180 14),(-162 18,-154 18,-154 23,-162 23,-162 18))'

mkdir -p "$WORK/src" "$WORK/clip"
FEATURES="$WORK/features.geojsonl"
: > "$FEATURES"

# clipped <ne-layer-stem>: Natural Earth layer, downloaded once and clipped to
# the map's area, as one GeoJSON feature per line.
clipped() {
  local raw="$WORK/src/$1.geojson" out="$WORK/clip/$1.geojsonl"
  if [ ! -s "$raw" ]; then
    echo "[tiles] downloading $1" >&2
    curl -fsSL --retry 3 -o "$raw" "$NE_BASE/$1.geojson"
  fi
  if [ ! -s "$out" ]; then
    ogr2ogr -f GeoJSONSeq -lco RS=NO -clipdst "$CLIP" -skipfailures "$out" "$raw" 2>/dev/null
  fi
  echo "$out"
}

# add <ne-layer> <tile-layer> <jq feature expression>
# The jq expression maps a Natural Earth feature to the one that goes into the
# tiles: a small, lower-case set of properties and a per-feature `tippecanoe`
# object (layer + minzoom [+ maxzoom]), so one tippecanoe run builds every
# layer and Natural Earth's own min_zoom / min_label decide where each appears.
add() {
  local src; src=$(clipped "$1")
  echo "[tiles] preparing $2 from $1"
  jq -c --arg layer "$2" --argjson maxz "$MAX_ZOOM" '
    def z(v): (if v == null then 0 else (v | floor) end) | [., $maxz] | min | [., 0] | max;
    '"$3"' | select(. != null)
      | .tippecanoe = {layer: $layer, minzoom: z(.tippecanoe.minzoom),
                       maxzoom: (if .tippecanoe.maxzoom == null then $maxz else z(.tippecanoe.maxzoom) end)}
  ' "$src" >> "$FEATURES"
}

# ── Land ────────────────────────────────────────────────────────────────────
# Natural Earth up to DETAIL_ZOOM-1; from DETAIL_ZOOM the OpenStreetMap
# coastline, which is still crisp at zoom 10.
add ne_10m_land land '
  {type: "Feature", geometry, properties: {}, tippecanoe: {minzoom: 0, maxzoom: '"$((DETAIL_ZOOM - 1))"'}}'

if [ "$MAX_ZOOM" -ge "$DETAIL_ZOOM" ]; then
  if [ ! -s "$WORK/clip/osm-land.geojsonl" ]; then
    if [ ! -s "$WORK/src/osm-land.zip" ]; then
      echo "[tiles] downloading OpenStreetMap land polygons" >&2
      curl -fsSL --retry 3 -o "$WORK/src/osm-land.zip" "$OSM_LAND_URL"
    fi
    unzip -q -o "$WORK/src/osm-land.zip" -d "$WORK/src/osm-land"
    shp=$(find "$WORK/src/osm-land" -name '*.shp' | head -1)
    echo "[tiles] clipping OpenStreetMap land polygons" >&2
    ogr2ogr -f GeoJSONSeq -lco RS=NO -t_srs EPSG:4326 -clipdst "$CLIP" -skipfailures \
      "$WORK/clip/osm-land.geojsonl" "$shp" 2>/dev/null
  fi
  echo "[tiles] preparing land (OpenStreetMap coastline, z$DETAIL_ZOOM+)"
  jq -c --argjson minz "$DETAIL_ZOOM" --argjson maxz "$MAX_ZOOM" \
    '{type: "Feature", geometry, properties: {}, tippecanoe: {layer: "land", minzoom: $minz, maxzoom: $maxz}}' \
    "$WORK/clip/osm-land.geojsonl" >> "$FEATURES"
fi

# ── Borders ─────────────────────────────────────────────────────────────────
# National borders (US–Canada, US–Mexico and the context countries), and the
# US state lines only: Canadian provinces and Mexican states would compete
# with the almanacs' own geography.
add ne_10m_admin_0_boundary_lines_land boundaries '
  {type: "Feature", geometry,
   properties: {kind: .properties.FEATURECLA},
   tippecanoe: {minzoom: 0}}'

add ne_10m_admin_1_states_provinces_lines state_boundaries '
  select(.properties.ADM0_A3 == "USA" or .properties.adm0_a3 == "USA")
  | {type: "Feature", geometry, properties: {}, tippecanoe: {minzoom: 2}}'

# a label point per US state (Natural Earth places it by hand)
add ne_10m_admin_1_states_provinces state_labels '
  select(.properties.adm0_a3 == "USA" and .properties.latitude != null and .properties.longitude != null)
  | {type: "Feature",
     geometry: {type: "Point", coordinates: [.properties.longitude, .properties.latitude]},
     properties: {name: .properties.name, abbr: .properties.postal},
     tippecanoe: {minzoom: 3}}'

# ── Cities and towns ────────────────────────────────────────────────────────
# Natural Earth's hand-ranked places up to DETAIL_ZOOM-1; from DETAIL_ZOOM
# every GeoNames place in the US of 1,000 people or more (and smaller county
# seats), each appearing at a zoom set by its population, plus the larger
# Canadian and Mexican cities for context. Both carry name, rank (2 largest …
# 10) and capital (0/1). Hawaii's places are left out.
add ne_10m_populated_places places '
  {type: "Feature", geometry,
   properties: {name: (.properties.NAME_EN // .properties.NAME), rank: .properties.SCALERANK,
                capital: (if .properties.ADM1CAP == 1 or .properties.ADM0CAP == 1 then 1 else 0 end)},
   tippecanoe: {minzoom: .properties.MIN_ZOOM, maxzoom: '"$((DETAIL_ZOOM - 1))"'}}'

if [ "$MAX_ZOOM" -ge "$DETAIL_ZOOM" ]; then
  if [ ! -s "$WORK/src/cities1000.txt" ]; then
    echo "[tiles] downloading GeoNames cities1000" >&2
    curl -fsSL --retry 3 -o "$WORK/src/cities1000.zip" "$GEONAMES_URL"
    unzip -q -o "$WORK/src/cities1000.zip" -d "$WORK/src"
  fi
  echo "[tiles] preparing places (GeoNames, z$DETAIL_ZOOM+)"
  # tab-separated: 2 name, 5 lat, 6 lon, 8 feature code, 9 country, 11 admin1,
  # 15 population. Codes: PPLA* administrative seats, PPL* other populated
  # places; skipped: PPLX (part of a city), PPLQ / PPLW (abandoned, destroyed).
  # Modern suburbs are left out: a plain town (PPL) under 100,000 within
  # SUBURB_KM of a city of 250,000 or more is skipped, so a metro area shows
  # its city and county seats, not the twentieth century's municipalities.
  # (Two passes over the file: the first collects the big cities.)
  awk -F'\t' -v minz="$DETAIL_ZOOM" -v maxz="$MAX_ZOOM" -v suburb_km="${SUBURB_KM:-30}" '
    function esc(s) { gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s); return s }
    function near_big(lat, lon,   i, dx, dy) {
      for (i = 1; i <= nbig; i++) {
        dy = (lat - blat[i]) * 111; dx = (lon - blon[i]) * 111 * cos(lat * 3.14159265 / 180)
        if (dx * dx + dy * dy < suburb_km * suburb_km) return 1
      }
      return 0
    }
    NR == FNR { if ($8 ~ /^PPL/ && $15 + 0 >= 250000) { nbig++; blat[nbig] = $5; blon[nbig] = $6 } next }
    $8 ~ /^PPL/ && $8 != "PPLX" && $8 != "PPLQ" && $8 != "PPLW" && $2 != "" {
      pop = $15 + 0
      us = ($9 == "US" && $11 != "HI")
      if (!us && !(($9 == "CA" || $9 == "MX") && pop >= 50000)) next
      if ($8 == "PPL" && pop < 100000 && near_big($5, $6)) next
      if (pop >= 1000000)     { rank = 2;  z = minz }
      else if (pop >= 300000) { rank = 4;  z = minz }
      else if (pop >= 100000) { rank = 6;  z = minz }
      else if (pop >= 25000)  { rank = 8;  z = minz + 1 }
      else if (pop >= 5000)   { rank = 9;  z = minz + 2 }
      else                    { rank = 10; z = minz + 3 }
      cap = ($8 == "PPLA") ? 1 : 0
      if (cap) z = minz
      if (z > maxz) z = maxz
      printf "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[%s,%s]},\"properties\":{\"name\":\"%s\",\"rank\":%d,\"capital\":%d},\"tippecanoe\":{\"layer\":\"places\",\"minzoom\":%d,\"maxzoom\":%d}}\n",
        $6, $5, esc($2), rank, cap, z, maxz
    }' "$WORK/src/cities1000.txt" "$WORK/src/cities1000.txt" >> "$FEATURES"
fi

# ── Water ───────────────────────────────────────────────────────────────────
# The world layers plus Natural Earth's North America supplements, which add
# the smaller rivers and lakes the almanacs' missions sat beside.
for layer in ne_10m_rivers_lake_centerlines ne_10m_rivers_north_america; do
  add "$layer" rivers '
    select(.properties.featurecla == "River" or .properties.featurecla == null)
    | {type: "Feature", geometry,
       properties: {name: (.properties.name_en // .properties.name), rank: (.properties.scalerank // 10)},
       tippecanoe: {minzoom: (.properties.min_zoom // 6)}}'
done

for layer in ne_10m_lakes ne_10m_lakes_north_america; do
  add "$layer" lakes '
    {type: "Feature", geometry,
     properties: {name: (.properties.name_en // .properties.name), rank: (.properties.scalerank // 10)},
     tippecanoe: {minzoom: (.properties.min_zoom // 5)}}'
done

# ── Sea and gulf names ──────────────────────────────────────────────────────
# Each clipped marine polygon is labelled at the centre of its bounding box.
add ne_10m_geography_marine_polys marine_labels '
  select(.properties.name != null)
  | (.geometry.coordinates | [.. | numbers]) as $flat
  | ([range(0; $flat | length; 2) as $i | $flat[$i]]) as $xs
  | ([range(1; $flat | length; 2) as $i | $flat[$i]]) as $ys
  | {type: "Feature",
     geometry: {type: "Point", coordinates: [((($xs | min) + ($xs | max)) / 2), ((($ys | min) + ($ys | max)) / 2)]},
     properties: {name: (.properties.name_en // .properties.name), kind: .properties.featurecla,
                  rank: .properties.scalerank},
     tippecanoe: {minzoom: .properties.min_label}}'

echo "[tiles] $(wc -l < "$FEATURES") features → $OUT (z0–$MAX_ZOOM)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs base map" \
  --description="North America (Hawaii excluded): Natural Earth 10m, OpenStreetMap coastline and GeoNames towns from zoom $DETAIL_ZOOM; zoom 0-$MAX_ZOOM" \
  --attribution="Natural Earth · © OpenStreetMap contributors · GeoNames" \
  --minimum-zoom=0 --maximum-zoom="$MAX_ZOOM" \
  --read-parallel \
  --drop-rate=1 \
  --coalesce-densest-as-needed --extend-zooms-if-still-dropping \
  --detect-shared-borders \
  --simplify-only-low-zooms \
  "$FEATURES"
# swap in atomically so a running tile server never reads a half-written file
mv "$OUT.tmp.pmtiles" "$OUT"
ls -l "$OUT"
