#!/usr/bin/env bash
# Entry point of the tile build job: builds the base map, the street detail,
# the historical boundaries and counties, streets, transport, diocese
# territories, Indian land cessions and present-day places to link to, or all of them (the default), into /data.
# Downloads are kept in /work.
#
#   docker compose run --rm tiles-build            # all of them
#   docker compose run --rm tiles-build base       # North American base map (minutes)
#   docker compose run --rm tiles-build detail     # streets around recorded places (longer: downloads the states with records once)
#   docker compose run --rm tiles-build history    # state and territory lines by date (a minute)
#   docker compose run --rm tiles-build ohm        # OpenHistoricalMap streets by date (a few minutes)
#   docker compose run --rm tiles-build transport  # railroads, canals, steamboat rivers by year (a few minutes)
#   docker compose run --rm tiles-build dioceses   # diocese territories by year (a minute; checks records if the DB is up)
#   docker compose run --rm tiles-build counties   # county lines by year (a few minutes; places records if the DB is up)
#   docker compose run --rm tiles-build cessions   # Indian land cessions with their dates (a minute; places records if the DB is up)
#   docker compose run --rm tiles-build links      # present-day places to link records to, from OpenStreetMap (needs the DB; ~10 minutes the first time)
set -euo pipefail

what=${1:-all}
case "$what" in
  base)   bash /tiles/build-tiles.sh /data/base.pmtiles /work ;;
  detail) bash /tiles/build-detail.sh /data/detail.pmtiles /work ;;
  history) bash /tiles/build-history.sh /data/history.pmtiles /work ;;
  ohm)    bash /tiles/build-ohm.sh /data/ohm.pmtiles /work ;;
  transport) bash /tiles/build-transport.sh /data/transport.pmtiles /work ;;
  dioceses) bash /tiles/build-dioceses.sh /data/dioceses.pmtiles /work ;;
  counties) bash /tiles/build-counties.sh /data/counties.pmtiles /work ;;
  cessions) bash /tiles/build-cessions.sh /data/cessions.pmtiles /work ;;
  links)  bash /tiles/build-links.sh /data/link-candidates.json /work ;;
  all)    bash /tiles/build-tiles.sh /data/base.pmtiles /work
          bash /tiles/build-history.sh /data/history.pmtiles /work
          bash /tiles/build-ohm.sh /data/ohm.pmtiles /work
          bash /tiles/build-transport.sh /data/transport.pmtiles /work
          bash /tiles/build-dioceses.sh /data/dioceses.pmtiles /work
          bash /tiles/build-counties.sh /data/counties.pmtiles /work
          bash /tiles/build-cessions.sh /data/cessions.pmtiles /work
          bash /tiles/build-detail.sh /data/detail.pmtiles /work
          if [ -n "${DB_HOST:-}" ]; then bash /tiles/build-links.sh /data/link-candidates.json /work; fi ;;
  *)      echo "usage: build.sh [base|detail|history|ohm|transport|dioceses|counties|cessions|links|all]" >&2; exit 2 ;;
esac
