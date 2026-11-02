#!/usr/bin/env python3
"""Each almanac record against the post offices open in its year
(build-frontier.sh), for the Frontier dashboard.

Usage: frontier-measures.py <features.geojsonl> [counties.geojsonl] < points.tsv > frontier.json
  features  the post offices from frontier-features.py (with from/to and est)
  counties  the dated county outlines (the counties build's counties.geojsonl):
            with them, each year's post offices per 100 square miles by county
  points    tab-separated `ID year latitude longitude` from the database

Writes:
  {"meta": {...},
   "records": {"<almanacRecordID>": [miles, estYear, within25]},
   "years": {"<year>": {"offices": n, "unchurched": n, "sample": [[lat, lng, name, state], ...],
                       "counties": {"<county id>": offices per 100 sq mi}}}}

miles     straight-line miles to the nearest post office open on 1 January
          of the record's year (null if none within 500 miles)
estYear   the year that nearest office opened
within25  post offices open that year within 25 miles
offices   post offices open that year in the lower 48
unchurched  of those, the ones with no almanac institution of that year
          within 25 miles; sample: up to 500 of them, spread across the
          country, for the map
"""
import json
import random
import sys
from collections import defaultdict

import numpy as np
from pyproj import Transformer
import shapely
from shapely import STRtree
from shapely.geometry import Point, shape

MILE = 1609.344
FAR = 500 * MILE
to_albers = Transformer.from_crs("EPSG:4326", "ESRI:102003", always_xy=True)

offices = []   # (x, y, from, to, est, name, state, lat, lng)
for row in open(sys.argv[1]):
    f = json.loads(row)
    lng, lat = f["geometry"]["coordinates"]
    p = f["properties"]
    if not (24 <= lat <= 50 and -125 <= lng <= -66):
        continue
    x, y = to_albers.transform(lng, lat)
    offices.append((x, y, p["from"], p["to"], p["est"], p["name"], p["state"], lat, lng))

# the counties, projected, with their area in square miles
counties = []
if len(sys.argv) > 2:
    for row in open(sys.argv[2]):
        f = json.loads(row)
        p = f["properties"]
        g = shapely.transform(shape(f["geometry"]), lambda xy: np.column_stack(to_albers.transform(xy[:, 0], xy[:, 1])))
        counties.append((p["id"], p["from"], p["to"], g, g.area / MILE ** 2))
    print(f"[frontier] {len(counties)} county outlines", file=sys.stderr)

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

records, years = {}, {}
random.seed(1)
for year in sorted(points):
    day = year * 10000 + 101
    open_ = [o for o in offices if o[2] <= day <= o[3]]
    pts = points[year]
    info = {"offices": len(open_), "unchurched": 0, "sample": []}
    if open_:
        geoms = [Point(o[0], o[1]) for o in open_]
        tree = STRtree(geoms)
        query = [Point(x, y) for _, x, y in pts]
        idx, dist = tree.query_nearest(query, return_distance=True, all_matches=False)
        nearest = {}
        for i, j, d in zip(np.asarray(idx)[0], np.asarray(idx)[1], np.asarray(dist)):
            nearest[i] = (j, d)
        # how many offices within 25 miles of each record
        within = tree.query(query, predicate="dwithin", distance=25 * MILE)
        counts = np.bincount(within[0], minlength=len(pts)) if within.size else np.zeros(len(pts), dtype=int)
        for i, (rid, _, _) in enumerate(pts):
            j, d = nearest.get(i, (None, None))
            miles = round(float(d) / MILE, 1) if d is not None and d <= FAR else None
            records[rid] = [miles, open_[j][4] if j is not None and miles is not None else None, int(counts[i])]
        # offices with no institution of that year within 25 miles
        inst_tree = STRtree(query)
        near_inst = inst_tree.query(geoms, predicate="dwithin", distance=25 * MILE)
        churched = set(np.asarray(near_inst[0]).tolist()) if near_inst.size else set()
        unchurched = [o for k, o in enumerate(open_) if k not in churched]
        info["unchurched"] = len(unchurched)
        sample = random.sample(unchurched, min(500, len(unchurched)))
        info["sample"] = [[round(o[7], 4), round(o[8], 4), o[5], o[6]] for o in sample]
        # the year's post offices per 100 square miles, by the county of that year
        if counties:
            valid = [c for c in counties if c[1] <= day <= c[2]]
            hits = tree.query([c[3] for c in valid], predicate="contains")
            per = np.bincount(hits[0], minlength=len(valid)) if hits.size else np.zeros(len(valid), dtype=int)
            info["counties"] = {c[0]: round(100 * int(n) / c[4], 2) for c, n in zip(valid, per) if c[4] > 0}
    else:
        for rid, _, _ in pts:
            records[rid] = [None, None, 0]
    years[year] = info
    beyond = sum(1 for rid, _, _ in pts if records[rid][0] is None or records[rid][0] > 15)
    print(f"[frontier] {year}: {len(open_)} offices open, {len(pts)} records, {beyond} beyond 15 mi of any office, "
          f"{info['unchurched']} offices with no institution within 25 mi", file=sys.stderr)

json.dump({"meta": {"unit": "miles", "fields": ["miles", "estYear", "within25"],
                    "source": "Cameron Blevins and Richard W. Helbock, US Post Offices (Harvard Dataverse, CC0)"},
           "records": records, "years": years}, sys.stdout, separators=(",", ":"))
