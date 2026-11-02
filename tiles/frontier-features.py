#!/usr/bin/env python3
"""The post offices as dated points (build-frontier.sh).

Usage: frontier-features.py <us-post-offices.csv> > features.geojsonl

Keeps the offices with a location in the lower 48 and its margin. Each gets
name, state, est (the year it opened) and from/to as the transport layer
dates things: open from 1 January of the year after it was established (it
may have opened any day of that year) to 31 December of the year it was
discontinued, or 9999 if it never was. Where the record is marked as not
continuous the office closed and reopened between those years, which the
data cannot place; it is drawn as open throughout.
"""
import csv
import json
import sys

W, S, E, N = -131, 17, -60, 55
n = 0
with open(sys.argv[1], encoding="utf-8", errors="replace", newline="") as f:
    for r in csv.DictReader(f):
        if r["Coordinates"] != "TRUE":
            continue
        try:
            lat, lng, est = float(r["Latitude"]), float(r["Longitude"]), int(r["Established"])
        except ValueError:
            continue
        if not (S <= lat <= N and W <= lng <= E):
            continue
        disc = r["Discontinued"].strip()
        to = 99991231 if disc in ("", "NA") else int(float(disc)) * 10000 + 1231
        if to < (est + 1) * 10000 + 101:
            to = (est + 1) * 10000 + 1231   # opened and closed within a year: show it that one year
        props = {"name": r["OrigName"].title(), "state": r["State"], "est": est,
                 "from": (est + 1) * 10000 + 101, "to": to}
        print(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lng, 5), round(lat, 5)]},
                          "properties": props}, ensure_ascii=False))
        n += 1
print(f"[frontier] {n} located post offices", file=sys.stderr)
