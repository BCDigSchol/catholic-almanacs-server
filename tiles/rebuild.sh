#!/usr/bin/env bash
# One command for the map tiles: downloads what's missing, builds the tiles
# and the data files the API reads, then restarts the tile server and the API
# so they serve the new files. Run from anywhere:
#
#   tiles/rebuild.sh            # everything (the first time: an hour or more, mostly downloads)
#   tiles/rebuild.sh data       # only the builds that read the database: after a reseed
#   tiles/rebuild.sh frontier   # any one build, or several: tiles/rebuild.sh counties transport
#
# Downloads are kept in the tiles-work volume, so later runs fetch nothing
# again. Needs Docker; starts the database if it isn't running.
set -euo pipefail
cd "$(dirname "$0")/.."

targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(all)
started=$(date +%s)
step() { printf '\n\033[1m== %s\033[0m (%s)\n' "$1" "$(date +%H:%M:%S)"; }

step "database"
docker compose up -d mysqldb-prod >/dev/null
for i in $(seq 1 60); do
  docker compose exec -T mysqldb-prod sh -c 'mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1 && break
  [ "$i" = 60 ] && { echo "the database didn't come up" >&2; exit 1; }
  sleep 2
done
echo "up"

step "build image"
# rebuilt every time, so edits to the build scripts are picked up
docker compose --profile build build tiles-build

for t in "${targets[@]}"; do
  step "tiles-build $t"
  docker compose run --rm tiles-build "$t"
done

step "tile server"
docker compose up -d --build tiles

step "API"
# the API reads the built JSON files and builds its caches at start
docker compose up -d --build nodejs-prod

step "done in $(( ($(date +%s) - started) / 60 )) min"
docker compose run --rm --no-deps --entrypoint sh tiles-build -c 'cd /data && ls -lh *.pmtiles *.json 2>/dev/null | awk "{print \$5, \$9}"'
