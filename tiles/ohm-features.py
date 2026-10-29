#!/usr/bin/env python3
"""Turns OpenHistoricalMap streets and railways into dated tile features.

Reads GeoJSON features (one per line, from osmium export) and writes those
with a usable start date, each with the days it existed as `from` and `to`
(yyyymmdd integers, both inclusive, like history.pmtiles), so a map can show
the streets of one year. A feature with no end date is still there (`to`
99991231). Undated features are dropped: they can't be placed in time.

OpenHistoricalMap dates are ISO-like but loose ("1850", "1850-05",
"1850-05-12", "~1850", "1850~", "1850s"): the first year[-month[-day]] in the
value is used, a start at the first day it can mean, an end at the last.

Usage: ohm-features.py < ohm.geojsonl > features.geojsonl
"""
import calendar
import json
import re
import sys

DATE = re.compile(r"(?<![\d-])(\d{4})(?:s)?(?:-(\d{2}))?(?:-(\d{2}))?")

ROADS = {"motorway": "major", "trunk": "major", "primary": "major",
         "secondary": "secondary", "tertiary": "secondary",
         "unclassified": "minor", "residential": "minor", "living_street": "minor",
         "pedestrian": "minor", "road": "minor", "service": "alley"}
ROAD_ZOOM = {"major": 10, "secondary": 11, "minor": 12, "alley": 14}
RAIL = {"rail", "narrow_gauge", "light_rail", "tram", "subway", "funicular"}


def day(value, end):
    """yyyymmdd for an OpenHistoricalMap date; an end date counts to its last day."""
    m = DATE.search(value or "")
    if not m:
        return None
    year = int(m.group(1))
    decade = value[m.end(1):m.end(1) + 1] == "s"
    if m.group(2) is None:
        return (year + 9 if decade else year) * 10000 + 1231 if end else year * 10000 + 101
    month = int(m.group(2))
    if not 1 <= month <= 12:
        return None
    if m.group(3) is None:
        last = calendar.monthrange(year, month)[1]
        return year * 10000 + month * 100 + (last if end else 1)
    return year * 10000 + month * 100 + int(m.group(3))


kept = undated = 0
for line in sys.stdin:
    feature = json.loads(line)
    tags = feature["properties"]
    start = day(tags.get("start_date"), end=False)
    if start is None:
        undated += 1
        continue
    finish = day(tags.get("end_date"), end=True) or 99991231
    props = {"from": start, "to": finish}
    if tags.get("name"):
        props["name"] = tags["name"]
    if tags.get("highway") in ROADS:
        props["kind"] = ROADS[tags["highway"]]
        tippecanoe = {"layer": "roads", "minzoom": ROAD_ZOOM[props["kind"]]}
    elif tags.get("railway") in RAIL:
        props["kind"] = "tram" if tags["railway"] in ("tram", "light_rail") else "rail"
        tippecanoe = {"layer": "rail", "minzoom": 11}
    else:
        continue
    print(json.dumps({"type": "Feature", "properties": props, "geometry": feature["geometry"],
                      "tippecanoe": tippecanoe}))
    kept += 1

print(f"[ohm] {kept} dated streets and railways ({undated} undated left out)", file=sys.stderr)
