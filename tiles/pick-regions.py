#!/usr/bin/env python3
"""Lists the Geofabrik US state extracts that overlap the detail area.

Reads Geofabrik's index (index-v1.json, with each region's boundary) and the
area polygon from make-area.py, and prints "<state> <pbf-url>" for every US
state whose boundary intersects the area, so the build downloads only the
states it needs (a margin crossing a state line pulls in the neighbour too).

Usage: pick-regions.py <index-v1.json> <area.geojson>
"""
import json
import sys

from shapely.geometry import shape

index = json.load(open(sys.argv[1]))
area = shape(json.load(open(sys.argv[2]))["features"][0]["geometry"])

for feature in index["features"]:
    props = feature["properties"]
    if not props["id"].startswith("us/") or feature.get("geometry") is None:
        continue
    if shape(feature["geometry"]).intersects(area):
        print(props["id"].split("/", 1)[1], props["urls"]["pbf"])
