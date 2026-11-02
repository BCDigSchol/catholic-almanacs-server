#!/usr/bin/env python3
"""Turns the Newberry historical counties into dated tile features.

Reads the county versions as GeoJSON features (one per line, from ogr2ogr) and
writes each one's outline (layer "counties") and a label point inside it
(layer "county_labels"), with the dates it was in force, as
history-features.py does for the states. The outlines also go to
<counties.geojsonl>, for placing records in them.

Properties: id (the atlas's county id, e.g. "ars_desha"), name ("Desha"),
state, kind (County, Parish, District …, from CNTY_TYPE), from and to
(yyyymmdd, both days inclusive).

Usage: counties-features.py <counties.geojsonl> < counties.geojsonl > features.geojsonl
"""
import json
import sys

from shapely.geometry import mapping, shape
from shapely.ops import polylabel, unary_union
from shapely.validation import make_valid

out_path = sys.argv[1]


def title(name):
    """DESHA -> Desha, ST. LOUIS -> St. Louis, MCLEAN -> McLean."""
    words = []
    for w in name.lower().split(' '):
        w = w.capitalize()
        if w.startswith('Mc') and len(w) > 2:
            w = 'Mc' + w[2:].capitalize()
        words.append(w)
    return ' '.join(words).replace("O'n", "O'N")


count = 0
with open(out_path, 'w') as territories:
    for line in sys.stdin:
        feature = json.loads(line)
        p = feature['properties']
        if feature.get('geometry') is None or p['STATE_TERR'] == 'Hawaii':
            continue
        props = {'id': p['ID'], 'name': title(p['NAME'] or p['FULL_NAME'] or ''), 'state': p['STATE_TERR'],
                 'kind': p['CNTY_TYPE'] or 'County', 'from': p['START_N'], 'to': p['END_N']}
        # a few outlines cross themselves: repair, keeping only the areas
        geom = make_valid(shape(feature['geometry']))
        geom = unary_union([g for g in getattr(geom, 'geoms', [geom]) if g.geom_type in ('Polygon', 'MultiPolygon')])
        if geom.is_empty:
            continue
        outline = mapping(geom)
        largest = max(getattr(geom, 'geoms', [geom]), key=lambda g: g.area)
        try:
            label = polylabel(largest, tolerance=0.005)
        except Exception:
            label = largest.representative_point()
        print(json.dumps({'type': 'Feature', 'properties': props, 'geometry': outline,
                          'tippecanoe': {'layer': 'counties'}}))
        print(json.dumps({'type': 'Feature', 'properties': {**props, 'area': round(geom.area, 4)},
                          'geometry': mapping(label), 'tippecanoe': {'layer': 'county_labels'}}))
        territories.write(json.dumps({'type': 'Feature', 'properties': props, 'geometry': outline}) + '\n')
        count += 1
print(f'[counties] {count} county versions', file=sys.stderr)
