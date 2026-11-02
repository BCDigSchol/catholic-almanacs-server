#!/usr/bin/env python3
"""Places every almanac record in the county it lay in that year.

Reads the dated county outlines (from counties-features.py) and, on stdin, the
records as tab-separated ID, year, latitude, longitude (mysql -N -B). Writes
JSON: {"records": {"<almanacRecordID>": ["<county id>", "<name>", "<state>"]}}
for each record inside a county in force on 1 January of its year. The API
compares these with the county the almanac gave.

Usage: record-counties.py <counties.geojsonl> < records.tsv > record-counties.json
"""
import json
import sys

from shapely import STRtree
from shapely.geometry import Point, shape
from shapely.prepared import prep

counties = [json.loads(line) for line in open(sys.argv[1])]
geoms = [shape(c['geometry']) for c in counties]
prepared = [prep(g) for g in geoms]
tree = STRtree(geoms)

out = {}
for line in sys.stdin:
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 4:
        continue
    rec, year, lat, lng = parts
    try:
        day, point = int(year) * 10000 + 101, Point(float(lng), float(lat))
    except ValueError:
        continue
    for i in tree.query(point):
        p = counties[i]['properties']
        if p['from'] <= day <= p['to'] and prepared[i].covers(point):
            out[rec] = [p['id'], p['name'], p['state']]
            break
json.dump({'records': out}, sys.stdout, separators=(',', ':'))
print(f'[counties] placed {len(out)} records in a county', file=sys.stderr)
