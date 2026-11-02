#!/usr/bin/env bash
# Builds the historic trails and roads (one PMTiles file, zooms 2–12): the
# Santa Fe, Oregon, California and Mormon trails, the caminos reales, the
# Old Spanish Trail, the Butterfield mail and Pony Express routes and the
# Trail of Tears, each with the years it was in use, so a map set to a year
# draws that year's routes beside its railroads and rivers.
#
# The alignments come from the National Park Service's National Trails office
# (IRMA DataStore, as ArcGIS feature services; works of the U.S. government,
# public domain); which trails, their years and their services are in
# trails.csv. Downloads are kept in the work dir; REFRESH_TRAILS=1 fetches
# them again.
#
# Usage: build-trails.sh <out.pmtiles> [work-dir]
# Needs: curl, python3 + shapely + pyproj, tippecanoe; the mysql client for the
# distances. Database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
set -euo pipefail

OUT=${1:?usage: build-trails.sh <out.pmtiles> [work-dir]}
WORK=${2:-$(mktemp -d)}
HERE=$(cd "$(dirname "$0")" && pwd)
BASE=${TRAILS_SERVICES:-https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services}

D="$WORK/trails"
mkdir -p "$D/src"

# one GeoJSON file per trail, fetched a page at a time (the services answer
# at most 1,000 features a query; the Trail of Tears has 2,000 segments)
grep -v '^#' "$HERE/trails.csv" | tail -n +2 | while IFS=, read -r id _rest; do
  layer=$(python3 -c "import csv,sys; r=[x for x in csv.DictReader(l for l in open(sys.argv[1]) if not l.startswith('#')) if x['id']==sys.argv[2]][0]; print(r['layer'])" "$HERE/trails.csv" "$id")
  f="$D/src/$id.geojson"
  if [ -s "$f" ] && [ -z "${REFRESH_TRAILS:-}" ]; then continue; fi
  echo "[trails] $id: fetching $layer" >&2
  python3 - "$BASE/$layer" "$f" <<'EOF'
import json, sys, urllib.request, urllib.parse
url, out = sys.argv[1], sys.argv[2]
features, offset = [], 0
while True:
    q = urllib.parse.urlencode({"where": "1=1", "outFields": "OBJECTID", "returnGeometry": "true", "outSR": "4326",
                                "resultOffset": offset, "resultRecordCount": 1000, "f": "geojson"})
    with urllib.request.urlopen(f"{url}/query?{q}", timeout=120) as r:
        page = json.load(r)
    if "error" in page:
        raise SystemExit(f"{url}: {page['error']}")
    features += page.get("features", [])
    if not page.get("properties", {}).get("exceededTransferLimit") or not page.get("features"):
        break
    offset += len(page["features"])
json.dump({"type": "FeatureCollection", "features": features}, open(out, "w"))
print(f"[trails]   {len(features)} features", file=sys.stderr)
EOF
done

echo "[trails] preparing features"
python3 "$HERE/trails-features.py" "$HERE/trails.csv" "$D/src" > "$D/features.geojsonl"
# each record's distance to the trails of its year, for the Rails, Rivers and
# Trails dashboard (trail-distances.json beside the tiles, read by the API)
DIST="$(dirname "$OUT")/trail-distances.json"
if [ -n "${DB_HOST:-}" ]; then
  echo "[trails] measuring each record's distance to the trails of its year"
  mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e \
    "SELECT ID, year, latitude, longitude FROM almanacRecords WHERE latitude IS NOT NULL AND longitude IS NOT NULL" 2>/dev/null \
    | python3 "$HERE/trail-distances.py" "$D/features.geojsonl" > "$DIST.tmp"
  mv "$DIST.tmp" "$DIST"
  echo "[trails] wrote $DIST ($(du -h "$DIST" | cut -f1))"
else
  echo "[trails] no database configured: skipping the distances"
fi

echo "[trails] $(wc -l < "$D/features.geojsonl" | tr -d ' ') features → $OUT (z2–12)"
mkdir -p "$(dirname "$OUT")"
tippecanoe \
  --force --output="$OUT.tmp.pmtiles" \
  --name="Catholic Almanacs historic trails" \
  --description="Historic trails and roads with their years in use, from the National Park Service's National Trails office; zoom 2-12" \
  --attribution="Trails: National Park Service, National Trails office" \
  --layer=trails \
  --minimum-zoom=2 --maximum-zoom=12 \
  --simplification=4 --no-tiny-polygon-reduction \
  --coalesce --reorder \
  "$D/features.geojsonl"
mv "$OUT.tmp.pmtiles" "$OUT"
ls -l "$OUT"
