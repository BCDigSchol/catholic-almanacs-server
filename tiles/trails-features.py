#!/usr/bin/env python3
"""Tags each trail's lines with its name, kind and years (build-trails.sh).

Usage: trails-features.py <trails.csv> <src-dir> > features.geojsonl
  src-dir holds <id>.geojson per trail (the NPS alignments, geometry only).

Each line feature gets: id, name, short, kind, from, to (yyyymmdd, as the
transport layer dates things: from 1 January of the first year to 31
December of the last) and the note. The services' own fields differ from
trail to trail and are dropped.
"""
import csv
import json
import os
import sys

rows = [r for r in csv.DictReader(l for l in open(sys.argv[1], encoding="utf-8") if not l.startswith("#"))]
src = sys.argv[2]
n = 0
for r in rows:
    path = os.path.join(src, f"{r['id']}.geojson")
    if not os.path.exists(path):
        print(f"[trails] no file for {r['id']}", file=sys.stderr)
        continue
    props = {"id": r["id"], "name": r["name"], "short": r["short"], "kind": r["kind"],
             "from": int(r["from"]) * 10000 + 101, "to": int(r["to"]) * 10000 + 1231, "note": r["note"]}
    for f in json.load(open(path))["features"]:
        g = f.get("geometry")
        if not g or g["type"] not in ("LineString", "MultiLineString"):
            continue
        print(json.dumps({"type": "Feature", "geometry": g, "properties": props}, ensure_ascii=False))
        n += 1
print(f"[trails] {n} lines across {len(rows)} trails", file=sys.stderr)
