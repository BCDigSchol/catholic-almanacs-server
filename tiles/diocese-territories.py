#!/usr/bin/env python3
"""Places every almanac record in the diocese territory of its year.

Reads the dated territories (from dioceses-features.py) and, on stdin, the
records as tab-separated ID, year, latitude, longitude (mysql -N -B). Writes
JSON: {"records": {"<almanacRecordID>": "<diocese id>"}} for each record that
falls inside a territory in force on 1 January of its year; records outside
every drawn territory are left out. The API compares these with the diocese
each record was listed under.

Usage: diocese-territories.py <territories.geojsonl> < records.tsv > diocese-territories.json
"""
import json
import sys

from shapely import STRtree
from shapely.geometry import Point, shape
from shapely.prepared import prep

territories = [json.loads(line) for line in open(sys.argv[1])]
geoms = [shape(t["geometry"]) for t in territories]
prepared = [prep(g) for g in geoms]
tree = STRtree(geoms)

out = {}
for line in sys.stdin:
    parts = line.rstrip("\n").split("\t")
    if len(parts) < 4:
        continue
    rec, year, lat, lng = parts
    try:
        day, point = int(year) * 10000 + 101, Point(float(lng), float(lat))
    except ValueError:
        continue
    for i in tree.query(point):
        p = territories[i]["properties"]
        if p["from"] <= day <= p["to"] and prepared[i].covers(point):
            out[rec] = p["id"]
            break
json.dump({"records": out}, sys.stdout, separators=(",", ":"))
print(f"[dioceses] placed {len(out)} records in a territory", file=sys.stderr)
