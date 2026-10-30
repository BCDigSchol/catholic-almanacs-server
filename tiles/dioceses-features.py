#!/usr/bin/env python3
"""Turns the diocese boundary shapes into dated territories.

Reads the shapes as GeoJSON features (one per line, from ogr2ogr) and
dioceses/names.csv (which diocese id each shape belongs to, and the almanac
year it takes effect). Each shape is a diocese's territory from that year
until the diocese's next shape; the last one runs while the diocese is in the
timeline (dioceses/labels.csv).

The shapes were drawn as each diocese was founded, without always redrawing
the dioceses it was carved out of, so in any year a newer territory is cut out
of the older ones it overlaps: a parent loses what its new neighbour took.
Shapes that take effect in the same year are left as drawn.

Writes, for every stretch of years in which a diocese's territory and name
stay the same, its outline (layer "dioceses") and a label point inside it
(layer "diocese_labels"), with id, name, and from and to (dates as yyyymmdd
integers, both days inclusive, as history-features.py). The outlines also go
to <territories.geojsonl>, for placing records in them.

Usage: dioceses-features.py <names.csv> <labels.csv> <territories.geojsonl> < shapes.geojsonl > features.geojsonl
"""
import csv
import json
import sys
from collections import defaultdict

from shapely.geometry import mapping, shape
from shapely.ops import polylabel, unary_union
from shapely.validation import make_valid

names_csv, labels_csv, territories_path = sys.argv[1:4]
FIRST, LAST = 1830, 1895

# which diocese each shape belongs to, and from when
by_gid = {r["GlobalID"]: r for r in csv.DictReader(open(names_csv, encoding="utf-8")) if r["id"]}

# every diocese's name in every year it is in the timeline
labels = defaultdict(dict)
for r in csv.DictReader(open(labels_csv, encoding="utf-8")):
    labels[r["id"]][int(r["year"])] = r["name"]


def polygons(geom):
    """Only the areas of a geometry (differences can leave stray lines)."""
    parts = getattr(geom, "geoms", [geom])
    return unary_union([g for g in parts if g.geom_type in ("Polygon", "MultiPolygon") and not g.is_empty])


versions = defaultdict(list)   # id -> [(from, key, geometry)]
for line in sys.stdin:
    feature = json.loads(line)
    row = by_gid.get(feature["properties"].get("GlobalID"))
    if not row or feature.get("geometry") is None:
        continue
    start = int(row["from"])
    if not FIRST <= start <= LAST:
        continue
    geom = polygons(make_valid(shape(feature["geometry"])))
    if not geom.is_empty:
        versions[row["id"]].append((start, row["GlobalID"], geom))
for vs in versions.values():
    vs.sort(key=lambda v: v[0])


def last_year(did):
    years = labels.get(did)
    return max(years) if years else LAST


def name_in(did, year):
    """The diocese's name that year, else the latest one before it (gaps such as 1862–63)."""
    years = labels.get(did, {})
    before = [y for y in years if y <= year]
    return years[max(before)] if before else (years[min(years)] if years else did)


def active(year):
    """id -> the version in force that year."""
    out = {}
    for did, vs in versions.items():
        if year > last_year(did):
            continue
        current = [v for v in vs if v[0] <= year]
        if current:
            out[did] = current[-1]
    return out


# the years anything changes: a shape takes effect, or a diocese leaves the timeline
events = sorted({v[0] for vs in versions.values() for v in vs}
                | {last_year(d) + 1 for d in versions if last_year(d) < LAST})
events = [y for y in events if FIRST <= y <= LAST]

carved = {}           # (version key, cutters) -> geometry, reused while nothing changes
runs = defaultdict(list)   # id -> [[from, to, signature, geometry]]
for i, start in enumerate(events):
    end = (events[i + 1] - 1) if i + 1 < len(events) else LAST
    now = active(start)
    for did, (vfrom, key, geom) in now.items():
        cutters = tuple(sorted(k for d, (f, k, g) in now.items()
                               if d != did and f > vfrom and g.intersects(geom)))
        sig = (key, cutters)
        if sig not in carved:
            cut = [g for d, (f, k, g) in now.items() if k in cutters]
            carved[sig] = polygons(geom.difference(unary_union(cut))) if cut else geom
        last = runs[did][-1] if runs[did] else None
        if last and last[2] == sig and last[1] == start - 1:
            last[1] = end
        else:
            runs[did].append([start, end, sig, carved[sig]])

count = 0
with open(territories_path, "w") as territories:
    for did, rs in sorted(runs.items()):
        for start, end, _, geom in rs:
            if geom.is_empty:
                continue
            # split where the diocese's name changes
            pieces, piece_start = [], start
            for y in range(start + 1, end + 1):
                if name_in(did, y) != name_in(did, y - 1):
                    pieces.append((piece_start, y - 1))
                    piece_start = y
            pieces.append((piece_start, end))
            largest = max(getattr(geom, "geoms", [geom]), key=lambda g: g.area)
            label = mapping(polylabel(largest, tolerance=0.01))
            outline = mapping(geom)
            for a, b in pieces:
                props = {"id": did, "name": name_in(did, a), "from": a * 10000 + 101, "to": b * 10000 + 1231}
                print(json.dumps({"type": "Feature", "properties": props, "geometry": outline,
                                  "tippecanoe": {"layer": "dioceses"}}))
                print(json.dumps({"type": "Feature", "properties": {**props, "area": round(geom.area, 2)},
                                  "geometry": label, "tippecanoe": {"layer": "diocese_labels"}}))
                territories.write(json.dumps({"type": "Feature", "properties": props, "geometry": outline}) + "\n")
                count += 1
print(f"[dioceses] {len(versions)} dioceses, {sum(map(len, versions.values()))} shapes, "
      f"{count} dated territories", file=sys.stderr)
