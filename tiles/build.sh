#!/usr/bin/env bash
# Entry point of the tile build job: builds the base map, the street detail,
# the historical boundaries, streets and transport, or all of them (the
# default), into /data.
# Downloads are kept in /work.
#
#   docker compose run --rm tiles-build            # all of them
#   docker compose run --rm tiles-build base       # North American base map (minutes)
#   docker compose run --rm tiles-build detail     # streets around recorded places (longer: downloads the states with records once)
#   docker compose run --rm tiles-build history    # state and territory lines by date (a minute)
#   docker compose run --rm tiles-build ohm        # OpenHistoricalMap streets by date (a few minutes)
#   docker compose run --rm tiles-build transport  # railroads, canals, steamboat rivers by year (a few minutes)
set -euo pipefail

what=${1:-all}
case "$what" in
  base)   bash /tiles/build-tiles.sh /data/base.pmtiles /work ;;
  detail) bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  history) bash /tiles/build-history.sh /data/history.pmtiles /work ;;
  ohm)    bash /tiles/build-ohm.sh /data/ohm.pmtiles /work ;;
  transport) bash /tiles/build-transport.sh /data/transport.pmtiles /work ;;
  all)    bash /tiles/build-tiles.sh /data/base.pmtiles /work
          bash /tiles/build-history.sh /data/history.pmtiles /work
          bash /tiles/build-ohm.sh /data/ohm.pmtiles /work
          bash /tiles/build-transport.sh /data/transport.pmtiles /work
          bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  *)      echo "usage: build.sh [base|detail|history|ohm|transport|all]" >&2; exit 2 ;;
esac
