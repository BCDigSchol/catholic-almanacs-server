#!/usr/bin/env python3
"""How far each almanac record lay from the historic trails and roads in use
in its own year (build-trails.sh), as transport-distances.py does for the
railroads and waterways.

Reads the trail features (GeoJSON lines with from/to, WGS 84) and the records'
points (tab-separated `ID year latitude longitude` on stdin), projects both
to USA Contiguous Albers (metres), and writes JSON:

    {"meta": {...}, "records": {"<almanacRecordID>": trailMiles, ...}}

Straight-line miles to the nearest trail in use on 1 January of the record's
year, rounded to 0.1; null when none within 500 miles.

Usage: trail-distances.py <features.geojsonl> < points.tsv > out.json
"""
import json
import sys
from collections import defaultdict

import numpy as np
import shapely
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import Point, shape

MILE = 1609.344
FAR = 500 * MILE
to_albers = Transformer.from_crs("EPSG:4326", "ESRI:102003", always_xy=True)

trails = []
with open(sys.argv[1]) as f:
    for row in f:
        feat = json.loads(row)
        p = feat["properties"]
        geom = shapely.transform(shape(feat["geometry"]), lambda xy: np.column_stack(to_albers.transform(xy[:, 0], xy[:, 1])))
        trails.append((geom, p["from"], p["to"]))

points = defaultdict(list)   # year -> [(id, x, y)]
for row in sys.stdin:
    parts = row.rstrip("\n").split("\t")
    if len(parts) != 4 or parts[2] in ("", "NULL") or parts[3] in ("", "NULL"):
        continue
    rid, year, lat, lng = parts[0], int(parts[1]), float(parts[2]), float(parts[3])
    if not (24 <= lat <= 50 and -125 <= lng <= -66):
        continue
    x, y = to_albers.transform(lng, lat)
    points[year].append((rid, x, y))

records = {}
for year in sorted(points):
    pts = points[year]
    day = year * 10000 + 101
    geoms = [g for g, a, b in trails if a <= day <= b]
    out = [None] * len(pts)
    if geoms:
        tree = STRtree(geoms)
        idx, dist = tree.query_nearest([Point(x, y) for _, x, y in pts], return_distance=True, all_matches=False)
        for i, d in zip(np.asarray(idx)[0], np.asarray(dist)):
            if d <= FAR:
                out[i] = round(float(d) / MILE, 1)
    for (rid, _, _), d in zip(pts, out):
        records[rid] = d
    near = sum(1 for d in out if d is not None and d <= 5)
    print(f"[trails] {year}: {len(pts)} records, {len(geoms)} trail lines in use, {near} within 5 mi of one", file=sys.stderr)

json.dump({"meta": {"unit": "miles", "fields": ["trail"], "source": "National Park Service, National Trails office"},
           "records": records}, sys.stdout, separators=(",", ":"))
