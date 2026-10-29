#!/usr/bin/env bash
# Entry point of the tile build job: builds the base map, the street detail,
# the historical boundaries, or all three (the default), into /data.
# Downloads are kept in /work.
#
#   docker compose run --rm tiles-build            # all three
#   docker compose run --rm tiles-build base       # North American base map (minutes)
#   docker compose run --rm tiles-build detail     # streets around recorded places (longer: downloads the states with records once)
#   docker compose run --rm tiles-build history    # state and territory lines by date (a minute)
set -euo pipefail

what=${1:-all}
case "$what" in
  base)   bash /tiles/build-tiles.sh /data/base.pmtiles /work ;;
  detail) bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  history) bash /tiles/build-history.sh /data/history.pmtiles /work ;;
  all)    bash /tiles/build-tiles.sh /data/base.pmtiles /work
          bash /tiles/build-history.sh /data/history.pmtiles /work
          bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  *)      echo "usage: build.sh [base|detail|history|all]" >&2; exit 2 ;;
esac
