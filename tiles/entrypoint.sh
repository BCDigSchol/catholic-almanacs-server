#!/bin/sh
# Fills the public URL into the map styles, waits for the tiles, then starts
# Martin on the .pmtiles files in /data.
#
# TILES_PUBLIC_URL  where browsers reach this server (no trailing slash), e.g.
#                   http://localhost:8092 — the styles' tile and glyph URLs are
#                   built from it.
# ROUTE_PREFIX      set when a reverse proxy passes a path prefix through
#                   (e.g. /tiles); leave empty when it strips it.
# CACHE_SIZE_MB     Martin's in-memory tile cache (default 128).
set -eu

PUBLIC=${TILES_PUBLIC_URL:-http://localhost:8092}
PUBLIC=${PUBLIC%/}

mkdir -p /styles
for f in /styles-src/*.json; do
  sed "s|\${TILES_PUBLIC_URL}|$PUBLIC|g" "$f" > "/styles/$(basename "$f")"
done

# The tiles are built separately (docker compose run --rm tiles-build) into the
# shared volume; until then there is nothing to serve.
while ! ls /data/*.pmtiles >/dev/null 2>&1; do
  echo "[tiles] no tiles in /data yet: run 'docker compose run --rm tiles-build'; checking again in 30s"
  sleep 30
done

# only the tile files: /data also holds the API's JSON (transport distances,
# diocese territories), which Martin would try to read as GeoJSON
set -- --font /fonts --style /styles --cache-size "${CACHE_SIZE_MB:-128}" /data/*.pmtiles "$@"
if [ -n "${ROUTE_PREFIX:-}" ]; then
  set -- --route-prefix "$ROUTE_PREFIX" "$@"
fi

echo "[tiles] serving $(ls /data/*.pmtiles | tr '\n' ' ')at $PUBLIC${ROUTE_PREFIX:+ (route prefix $ROUTE_PREFIX)}"
exec martin "$@"
