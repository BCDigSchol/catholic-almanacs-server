#!/usr/bin/env python3
"""Places every almanac record in the Indian land cession(s) its point lies in.

Reads the cession areas (from cessions-features.py) and, on stdin, the records
as tab-separated ID, year, latitude, longitude (mysql -N -B). Writes JSON:
{"cessions": {"<number>": {tribes, ceded, dates, present, treaty, schedule}},
 "records": {"<almanacRecordID>": ["<number>", …]}}, the cessions for each
record in date order (Royce's areas overlap where land was ceded more than
once, or by more than one nation).

Usage: record-cessions.py <cessions.geojsonl> < records.tsv > record-cessions.json
"""
import json
import sys

from shapely import STRtree
from shapely.geometry import Point, shape
from shapely.prepared import prep

areas = [json.loads(line) for line in open(sys.argv[1])]
geoms = [shape(a['geometry']) for a in areas]
prepared = [prep(g) for g in geoms]
tree = STRtree(geoms)

records = {}
for line in sys.stdin:
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 4:
        continue
    rec, year, lat, lng = parts
    try:
        point = Point(float(lng), float(lat))
    except ValueError:
        continue
    hits = sorted({(areas[i]['properties']['ceded'], areas[i]['properties']['cession'])
                   for i in tree.query(point) if prepared[i].covers(point)})
    if hits:
        records[rec] = [c for _, c in hits]
cessions = {}
for a in areas:
    p = a['properties']
    cessions.setdefault(p['cession'], {k: p[k] for k in ('tribes', 'ceded', 'dates', 'present', 'treaty', 'schedule')})
json.dump({'cessions': cessions, 'records': records}, sys.stdout, separators=(',', ':'))
print(f'[cessions] placed {len(records)} records in a cession', file=sys.stderr)
