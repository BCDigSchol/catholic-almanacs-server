#!/usr/bin/env python3
"""Marks every almanac record that stands on land the United States took from Mexico.

Reads the Newberry states and territories (as GeoJSON lines, from ogr2ogr)
and, on stdin, the records as tab-separated ID, year, latitude, longitude.
For each record, the first United States state or territory its point lay in
(the atlas's "Other" areas, such as the Republic of Texas and the Oregon
Country, were not United States land) says how the place came to the Union:

  texas    Texas, annexed 29 December 1845
  claim    land Texas claimed from 1845 but Mexico held until 1848 (Santa Fe,
           the upper Rio Grande): in Texas in 1845, outside it by 1851
  cession  the Mexican Cession, Treaty of Guadalupe Hidalgo (in force 4 July 1848)
  gadsden  the Gadsden Purchase (30 December 1853)

Writes JSON: {"records": {"<almanacRecordID>": ["<how>", <yyyymmdd>]}}.

Usage: record-mexican-lands.py <states.geojsonl> < records.tsv > mexican-lands.json
"""
import json
import sys

from shapely import STRtree
from shapely.geometry import Point, shape
from shapely.prepared import prep
from shapely.validation import make_valid

US_TYPES = {'State', 'Territory', 'Unorganized Territory', 'District of Columbia'}
areas = []
for line in open(sys.argv[1]):
    f = json.loads(line)
    p = f['properties']
    if p['TERR_TYPE'] not in US_TYPES or not f.get('geometry'):
        continue
    areas.append((p['NAME'], p['START_N'], p['END_N'], make_valid(shape(f['geometry']))))
geoms = [a[3] for a in areas]
prepared = [prep(g) for g in geoms]
tree = STRtree(geoms)

out = {}
for line in sys.stdin:
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 4:
        continue
    rec, year, lat, lng = parts
    try:
        point = Point(float(lng), float(lat))
    except ValueError:
        continue
    # the West south of 42°N, the old line with Spain and Mexico
    if point.x > -93.5 or point.y > 42.1:
        continue
    hits = sorted((areas[i] for i in tree.query(point) if prepared[i].covers(point)), key=lambda a: a[1])
    if not hits:
        continue
    name, start = hits[0][0], hits[0][1]
    if name == 'Mexican Cession':
        out[rec] = ['cession', start]
    elif name == 'Gadsden Purchase':
        out[rec] = ['gadsden', start]
    elif name == 'Texas' and start == 18451229:
        in_1851 = next((a for a in hits if a[1] <= 18510101 <= a[2]), None)
        out[rec] = ['texas', start] if in_1851 and in_1851[0] == 'Texas' else ['claim', 18480704]
json.dump({'records': out}, sys.stdout, separators=(',', ':'))
print(f'[history] {len(out)} records on land taken from Mexico', file=sys.stderr)
