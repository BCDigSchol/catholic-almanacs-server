#!/usr/bin/env bash
# Keeps a state's churches, schools, colleges, hospitals and monasteries from
# an OpenStreetMap extract (with the nodes their outlines need), for
# build-links.sh to match the almanacs' institutions to. Every denomination is
# kept here; record-links.py picks out the Catholic ones.
#
# Usage: filter-places.sh <state.osm.pbf> <out.places.osm.pbf>
set -euo pipefail
osmium tags-filter --overwrite -o "$2" "$1" \
  nwr/amenity=place_of_worship,school,college,university,hospital,monastery
