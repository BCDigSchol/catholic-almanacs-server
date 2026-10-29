#!/usr/bin/env python3
"""Turns the Newberry states-and-territories shapefile into tile features.

Reads the shapefile as GeoJSON features (one per line, from ogr2ogr) and
writes, for every dated version of a state or territory, its outline
(layer "states") and one label point inside it (layer "state_labels"), each
with the dates it was in force, so the map can show the boundaries of any
day by filtering on them. Hawaii is left out, as everywhere on this map.

Properties: name, kind (state | territory | district | other), from and to
(dates as yyyymmdd integers, both days inclusive).

It also adds label points for the neighbouring countries under their names of
the time (kind "nation"), since the dated map tints all land outside the
United States of that day.

Usage: history-features.py < states.geojsonl > features.geojsonl
"""
import json
import sys

from shapely.geometry import mapping, shape
from shapely.ops import polylabel

KINDS = {"State": "state", "Territory": "territory", "Unorganized Territory": "territory",
         "District of Columbia": "district", "Other": "other"}

# (name, from, to, lon, lat): where each neighbour's name goes, placed so it
# sits on that country's land at every date it is used
NEIGHBOURS = [
    ("New Spain", 17830903, 18210927, -103, 27),
    ("Mexico", 18210928, 20001231, -103, 27),
    # Rupert's Land stayed British until it joined Canada on 15 July 1870
    ("British North America", 17830903, 18700714, -90, 50),
    ("Dominion of Canada", 18670701, 20001231, -78, 47.5),
    ("Russian America", 17830903, 18671017, -152, 64),
]

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

for name, start, end, lon, lat in NEIGHBOURS:
    print(json.dumps({"type": "Feature",
                      "properties": {"name": name, "kind": "nation", "from": start, "to": end, "area": 50},
                      "geometry": {"type": "Point", "coordinates": [lon, lat]},
                      "tippecanoe": {"layer": "state_labels"}}))

print(f"[history] {versions} dated state and territory versions", file=sys.stderr)
