#!/usr/bin/env python3
"""How far each almanac record lay from the railroads, and from the canals and
steamboat rivers, of its own year.

Reads the railroad and water-route features (GeoJSON lines, WGS 84) and the
records' points (tab-separated `ID year latitude longitude` on stdin, from the
database), projects both to USA Contiguous Albers (metres; Atack's own
projection), and writes JSON:

    {"meta": {...}, "records": {"<almanacRecordID>": [railMiles, waterMiles], ...}}

Distances are straight-line miles to the nearest line in use on 1 January of
the record's year (a railroad in operation by then; a canal or river open
then), rounded to 0.1; null when none was in use within 500 miles.

With a fourth argument, the dated county outlines (the counties build's
counties.geojsonl), also each year's miles of working railroad per 100 square
miles by county, under "counties": {"<year>": {"<county id>": miles}}.

Usage: transport-distances.py <rail.geojsonl> <canals.geojsonl> <rivers.geojsonl> [counties.geojsonl] < points.tsv > out.json
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
# Atack's projection: USA Contiguous Albers Equal Area Conic (ESRI:102003)
to_albers = Transformer.from_crs("EPSG:4326", "ESRI:102003", always_xy=True)


def lines(path):
    """[(geometry, from_day, to_day)] from a GeoJSON-lines file with from/to."""
    out = []
    with open(path) as f:
        for row in f:
            feat = json.loads(row)
            p = feat["properties"]
            if feat.get("geometry") and p.get("from") is not None:
                geom = shapely.transform(shape(feat["geometry"]), lambda xy: np.column_stack(to_albers.transform(xy[:, 0], xy[:, 1])))
                out.append((geom, p["from"], p["to"]))
    return out


rail = lines(sys.argv[1])
water = lines(sys.argv[2]) + lines(sys.argv[3])

# the counties, projected, with their area in square miles
counties = []
if len(sys.argv) > 4:
    with open(sys.argv[4]) as f:
        for row in f:
            feat = json.loads(row)
            p = feat["properties"]
            geom = shapely.transform(shape(feat["geometry"]), lambda xy: np.column_stack(to_albers.transform(xy[:, 0], xy[:, 1])))
            counties.append((p["id"], p["from"], p["to"], geom, geom.area / MILE ** 2))
    print(f"[transport] {len(counties)} county outlines", file=sys.stderr)

points = defaultdict(list)   # year -> [(id, x, y)]
for row in sys.stdin:
    parts = row.rstrip("\n").split("\t")
    if len(parts) != 4 or parts[2] in ("", "NULL") or parts[3] in ("", "NULL"):
        continue
    rid, year, lat, lng = parts[0], int(parts[1]), float(parts[2]), float(parts[3])
    if not (24 <= lat <= 50 and -125 <= lng <= -66):   # the lower 48 only (as the data)
        continue
    x, y = to_albers.transform(lng, lat)
    points[year].append((rid, x, y))


def nearest(network, year, pts):
    """Miles from each point to the nearest line of `network` in use that year."""
    day = year * 10000 + 101
    geoms = [g for g, a, b in network if a <= day <= b]
    if not geoms:
        return [None] * len(pts)
    tree = STRtree(geoms)
    query = [Point(x, y) for _, x, y in pts]
    idx, dist = tree.query_nearest(query, return_distance=True, all_matches=False)
    out = [None] * len(pts)
    for i, d in zip(np.asarray(idx)[0], np.asarray(dist)):
        if d <= FAR:
            out[i] = round(float(d) / MILE, 1)
    return out


records, by_county = {}, {}
for year in sorted(points):
    pts = points[year]
    r, w = nearest(rail, year, pts), nearest(water, year, pts)
    for (rid, _, _), dr, dw in zip(pts, r, w):
        records[rid] = [dr, dw]
    near = sum(1 for d in r if d is not None and d <= 5)
    print(f"[transport] {year}: {len(pts)} records, {near} within 5 mi of a railroad", file=sys.stderr)
    # the year's railroad miles in each county of that year, per 100 square miles
    if counties:
        day = year * 10000 + 101
        in_use = [g for g, a, b in rail if a <= day <= b]
        tree = STRtree(in_use)
        dens = {}
        for cid, a, b, poly, area in counties:
            if not (a <= day <= b) or area <= 0:
                continue
            total = 0.0
            for i in tree.query(poly, predicate="intersects"):
                total += in_use[i].intersection(poly).length
            dens[cid] = round(100 * total / MILE / area, 2)
        by_county[year] = dens

json.dump({"meta": {"unit": "miles", "fields": ["rail", "water"],
                    "source": "Jeremy Atack, historical transportation GIS (Vanderbilt)"},
           "records": records, "counties": by_county}, sys.stdout, separators=(",", ":"))
