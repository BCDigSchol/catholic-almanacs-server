#!/usr/bin/env python3
"""Turns the Newberry states-and-territories shapefile into tile features.

Reads the shapefile as GeoJSON features (one per line, from ogr2ogr) and
writes, for every dated version of a state or territory, its outline
(layer "states") and one label point inside it (layer "state_labels"), each
with the dates it was in force, so the map can show the boundaries of any
day by filtering on them. Hawaii is left out, as everywhere on this map.

Properties: name, kind (state | territory | district | other), from and to
(dates as yyyymmdd integers, both days inclusive).

Usage: history-features.py < states.geojsonl > features.geojsonl
"""
import json
import sys

from shapely.geometry import mapping, shape
from shapely.ops import polylabel

KINDS = {"State": "state", "Territory": "territory", "Unorganized Territory": "territory",
         "District of Columbia": "district", "Other": "other"}

versions = 0
for line in sys.stdin:
    feature = json.loads(line)
    p = feature["properties"]
    if p["NAME"].startswith("Hawaii") or feature.get("geometry") is None:
        continue
    props = {"name": p["FULL_NAME"] or p["NAME"], "kind": KINDS.get(p["TERR_TYPE"], "other"),
             "from": p["START_N"], "to": p["END_N"]}
    geom = shape(feature["geometry"])
    # the label goes at the point deepest inside the largest piece, so it sits
    # well inside odd shapes (Florida, Michigan, Indian Territory)
    largest = max(getattr(geom, "geoms", [geom]), key=lambda g: g.area)
    label = polylabel(largest, tolerance=0.01)
    print(json.dumps({"type": "Feature", "properties": props, "geometry": feature["geometry"],
                      "tippecanoe": {"layer": "states"}}))
    print(json.dumps({"type": "Feature", "properties": {**props, "area": round(geom.area, 2)},
                      "geometry": mapping(label), "tippecanoe": {"layer": "state_labels"}}))
    versions += 1

print(f"[history] {versions} dated state and territory versions", file=sys.stderr)
