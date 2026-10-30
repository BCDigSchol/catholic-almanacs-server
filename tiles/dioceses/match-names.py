#!/usr/bin/env python3
"""Matches the diocese boundary shapes to the app's diocese ids.

The shapes (DioceseEachYear.zip, drawn at Boston College) name each diocese as
the drawer wrote it; the app keys dioceses by id (bal.md, nyc.ny …) through its
timeline, server/data/dioceses-by-year.csv. This writes names.csv: one row per
shape with the id it belongs to, the almanac year it takes effect ("from"),
and how the match was made: the timeline's name, a close spelling, by hand (the
table below: review these), unmatched (left out of the map), or left out for a
placeholder year. build-dioceses.sh reads names.csv, so edit it by hand freely;
rerun this after a new export of the shapes and compare.

It also writes labels.csv (id, year, name): every diocese's name in every
almanac year, from the timeline, for the map's labels, with the timeline's
compact "VA…" forms spelt out ("VAColoradoUtah" -> "Vicariate Apostolic of
Colorado and Utah").

Usage: match-names.py <shapes.geojson> <dioceses-by-year.csv> <out-dir>
"""
import csv, json, re, sys, difflib, unicodedata
geo, timeline, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
def clean(s):
    s = re.sub(r'\(.*$', '', s or ''); s = re.sub(r'[?]+', '', s); s = re.sub(r'\s+\d[\d\s,]*$', '', s)
    return re.sub(r'\s+', ' ', s).strip()
def norm(s):
    s = unicodedata.normalize('NFD', clean(s).lower())
    return re.sub(r'[^a-z0-9]', '', s)
rows = list(csv.reader(open(timeline, encoding='utf-8-sig')))
head = rows[0]
years = {i: int(h) for i, h in enumerate(head) if h.strip().isdigit()}
names = {}   # id -> {year: name}
for r in rows[1:]:
    if not r or not r[0].strip(): continue
    did = r[0].strip()
    names[did] = {y: clean(r[i]) for i, y in years.items() if i < len(r) and r[i].strip() and not r[i].strip().lower().startswith('error')}
alias = {}
for did, by in names.items():
    for y, n in by.items(): alias.setdefault(norm(n), set()).add(did)
feats = json.load(open(geo))['features']
# Settled by hand: (shape name, year) -> (id, year it takes effect, why). Review these.
HAND = {
    ('Vicariate Apostolic of Nebraska', None): ('oma.ne', None, 'Nebraska vicariate became Omaha'),
    ('AZ Vicariate', 1869): ('tuc.az', None, 'Vicariate Apostolic of Arizona'),
    ('Brownsville', None): ('bro.tx', None, 'Vicariate Apostolic of Brownsville'),
    ('Dakota Territory', 1881): ('sio.sd', None, 'Vicariate Apostolic of Dakota'),
    ('Indiana', 1844): ('vin.in', None, 'the Diocese of Vincennes covered Indiana'),
    ('Marysville', None): ('gra.ca', None, 'VAMarysvilleCalifornia, later Grass Valley'),
    ('More Oregon?', 1847): ('ore.or', None, 'unsure: taken as more of Oregon City'),
    ('Richmond  - 74 on', 1869): ('ric.va', 1874, 'name says from 1874'),
    ('Richmond  - without tail', 1869): ('ric.va', None, 'the shape until 1874'),
    ('Salt Lake City', 1892): ('salt.ut', None, ''),
    ('South', 1890): ('sio.sd', None, 'unsure: taken as South Dakota (Sioux Falls)'),
    ('north', 1890): ('jam.nd', None, 'unsure: taken as North Dakota (Jamestown)'),
    ('Vicariate Apostolic East of the Rocky Mountains', 1859): ('kc.ks', None, 'VAEastRockyMountains, later Leavenworth'),
    ('Vicariate Apostolic of East Rocky Mountains', 1863): ('kc.ks', None, 'VAEastRockyMountains, later Leavenworth'),
    ('Vicariate Apostolic of Colorado', 1872): ('den.co', None, 'VAColorado, later Denver'),
    ('Vicariate Apostolic of Colorado and Utah', 1869): ('den.co', None, 'VAColoradoUtah, later Denver'),
    ('Wheeling Copy', 1874): ('whe.va', None, ''),
    ('Wisconsin + gap (need to check name!)', 1844): ('mil.wi', None, 'unsure: taken as Milwaukee'),
}
out = []
for f in feats:
    p = f['properties']; n = p['DioceseNam'].strip(); y = int(p['AlmanacYea'][:4])
    k = norm(n)
    how, did = '', ''
    # same name in the timeline that year (or the nearest year it existed)
    exact = [d for d in alias.get(k, ()) ]
    if len(exact) == 1: did, how = exact[0], 'name'
    elif len(exact) > 1:
        live = [d for d in exact if any(names[d].get(yy) and norm(names[d][yy]) == k for yy in range(y - 2, y + 3))]
        if len(live) == 1: did, how = live[0], 'name+year'
    if not did:
        close = difflib.get_close_matches(k, alias.keys(), n=1, cutoff=0.82)
        if close and len(alias[close[0]]) == 1: did, how = next(iter(alias[close[0]])), 'spelling'
    hand = HAND.get((n, y)) or HAND.get((n, None))
    effective = y
    if hand: did, effective, how = hand[0], hand[1] or y, 'by hand: ' + hand[2] if hand[2] else 'by hand'
    if y < 1830 or y > 1895: how = 'left out: placeholder year'
    out.append({'shape': n, 'year': y, 'from': effective, 'id': did if not how.startswith('left out') else '', 'how': how or 'unmatched',
                'timeline name': names.get(did, {}).get(y) or (sorted(set(names.get(did, {}).values()))[:1] or [''])[0],
                'notes': p['Notes'] or '', 'GlobalID': p['GlobalID']})
w = csv.DictWriter(open(outdir + '/names.csv', 'w', newline=''), fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(sorted(out, key=lambda r: (r['how'] != 'unmatched', r['shape'], r['year'])))
import collections; print(collections.Counter(r['how'] for r in out), file=sys.stderr)

def spelt_out(name):
    """The timeline's compact vicariates, written out for a map label."""
    m = re.match(r'^VA([A-Z].*)$', name)
    if not m: return name
    words = re.findall(r'[A-Z][a-z]+', m.group(1))
    # "MarysvilleCalifornia": a see and its state, not two territories
    if len(words) == 2 and words[1] in ('California', 'Oregon', 'Texas', 'Florida'):
        return f'Vicariate Apostolic of {words[0]}, {words[1]}'
    return 'Vicariate Apostolic of ' + (' and '.join(words) if len(words) == 2 and words[0] not in ('East', 'North', 'South', 'West') else ' '.join(words))
lw = csv.writer(open(outdir + '/labels.csv', 'w', newline=''))
lw.writerow(['id', 'year', 'name'])
for did in sorted(names):
    for y in sorted(names[did]):
        lw.writerow([did, y, spelt_out(names[did][y])])
