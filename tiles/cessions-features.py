#!/usr/bin/env python3
"""Turns the Forest Service's Indian land cessions into tile features.

Reads "Tribal Lands Ceded to the United States" (U.S. Forest Service, Office of
Tribal Relations, CC BY 4.0; digitised from Charles C. Royce's maps, 1899) as
GeoJSON and writes each cession's area (layer "cessions") with:

  cession  Royce's cession number          tribes   the nations as the schedule names them
  ceded    the first treaty date, yyyymmdd (the date it was signed)
  dates    every date given, "1842-10-04; …"
  present  present-day tribes (National NAGPRA)
  treaty   link to the treaty text (Kappler), schedule  link to Royce's schedule entry

A map set to a year draws the land ceded before 1 January of that year apart
from the land still held then (map-vis [cessions]). The areas also go to
<cessions.geojsonl>, for placing records in them.

Usage: cessions-features.py <cessions.geojsonl> < cessions.geojson > features.geojsonl
"""
import json
import sys

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

P = 'edws_usaBdyPol_TribalCededLandsTable'
out = open(sys.argv[1], 'w')


def val(p, k):
    v = p.get(P + k)
    return None if v in (None, 'None', '') else v


count = 0
for f in json.load(sys.stdin)['features']:
    p = f['properties']
    if not f.get('geometry'):
        continue
    dates = [val(p, f'cessdate{i}') for i in range(1, 6)]
    dates = [d[:10] for d in dates if d]
    if not dates:
        continue
    geom = make_valid(shape(f['geometry']))
    geom = unary_union([g for g in getattr(geom, 'geoms', [geom]) if g.geom_type in ('Polygon', 'MultiPolygon')])
    if geom.is_empty:
        continue
    props = {
        'cession': val(p, 'cessnum') or '',
        'ceded': int(dates[0].replace('-', '')),
        'dates': '; '.join(dates),
        'tribes': val(p, 'schdtrb') or '',
        'present': val(p, 'presdaytrb') or '',
        'treaty': val(p, 'date1link_kappler_treaty') or val(p, 'link_other_treaty') or val(p, 'link_executive_order') or val(p, 'link_federal_statute') or '',
        'schedule': val(p, 'date1link_royce_schedule') or '',
    }
    feature = {'type': 'Feature', 'properties': props, 'geometry': mapping(geom)}
    print(json.dumps({**feature, 'tippecanoe': {'layer': 'cessions'}}))
    out.write(json.dumps(feature) + '\n')
    count += 1
print(f'[cessions] {count} cession areas', file=sys.stderr)
