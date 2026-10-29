#!/usr/bin/env python3
"""Turns the grid cells that hold recorded places into one clip polygon.

Reads "cx cy" integer cell indices (one per line; cell = floor(coord / CELL))
on stdin, grows each cell by MARGIN cells on every side so a place is never at
the edge of its detail, unions the squares, and writes a GeoJSON
FeatureCollection with one (Multi)Polygon for osmium extract.

Usage: make-area.py <cell-degrees> <margin-cells> < cells.txt > area.geojson
"""
import json
import sys

from shapely.geometry import box, mapping
from shapely.ops import unary_union

cell = float(sys.argv[1])
margin = int(sys.argv[2])

squares = []
for line in sys.stdin:
    parts = line.split()
    if len(parts) != 2:
        continue
    cy, cx = int(parts[0]), int(parts[1])
    squares.append(box((cx - margin) * cell, (cy - margin) * cell,
                       (cx + 1 + margin) * cell, (cy + 1 + margin) * cell))

area = unary_union(squares)
print(f"[detail] {len(squares)} cells → {len(getattr(area, 'geoms', [area]))} areas, "
      f"{area.area:.1f} square degrees", file=sys.stderr)
json.dump({"type": "FeatureCollection",
           "features": [{"type": "Feature", "properties": {}, "geometry": mapping(area)}]}, sys.stdout)
