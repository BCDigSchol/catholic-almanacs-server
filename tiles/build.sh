#!/usr/bin/env bash
# Entry point of the tile build job: builds the base map, the street detail,
# or both (the default), into /data. Downloads are kept in /work.
#
#   docker compose run --rm tiles-build            # both
#   docker compose run --rm tiles-build base       # North American base map (minutes)
#   docker compose run --rm tiles-build detail     # streets around recorded places (longer: downloads the states with records once)
set -euo pipefail

what=${1:-all}
case "$what" in
  base)   bash /tiles/build-tiles.sh /data/base.pmtiles /work ;;
  detail) bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  all)    bash /tiles/build-tiles.sh /data/base.pmtiles /work
          bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  *)      echo "usage: build.sh [base|detail|all]" >&2; exit 2 ;;
esac
