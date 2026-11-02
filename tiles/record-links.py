#!/usr/bin/env python3
"""Suggests present-day places for the almanacs' institutions.

Matches each institution to Catholic churches, schools, colleges, hospitals and
convents in OpenStreetMap (ODbL, © OpenStreetMap contributors) near its
recorded place whose names share its dedication ("St. Mary's Church" and
"Saint Mary Catholic Church"). The suggestions are for a person to review
(the Data Issues page): a dedication is common, a parish may have moved or
merged, and many records are placed at their town, not their street.

Usage: record-links.py <places.geojsonl> [osm-date] < records.tsv > link-candidates.json
  places       OpenStreetMap's churches, schools, colleges, hospitals and
               monasteries (osmium export with type and id; build-links.sh)
  osm-date     when the extracts were fetched
  records.tsv  instID, year, instName, instType, latitude, longitude
               (the mysql client's batch output, no header)

Output: {"osmBase": ..., "institutions": {instID: [candidate, ...]}}, each
candidate {osm, name, kind, km, score, strength, denomination?, website?, wikipedia?, start?},
best first, at most three.
"""
import json
import math
import re
import sys
import unicodedata
from collections import defaultdict

from shapely.geometry import shape

# words that say what kind of place it is, not whom it is named for
GENERIC = set("""
church churches chapel chapels parish parishes cathedral co-cathedral basilica shrine mission missions station stations
catholic roman rc r c of the and at in on for a an new old
school schools parochial academy academies college colleges university seminary institute institution high elementary
grade grammar day free select prep preparatory primary middle
convent convents monastery priory abbey novitiate house home asylum asylums orphan orphans orphanage hospital infirmary
society sisters sister brothers fathers community
female male boys boy girls girl young ladies ladies gentlemen men women children
german french irish english polish italian spanish bohemian colored
congregation congregations building hall center centre campus site
boarding classical theological department petit seminaire historic benevolent select
""".split())
# OSM names with these words belong to another church
OTHER_CHURCH = re.compile(r"\b(lutheran|episcopal|anglican|methodist|baptist|presbyterian|reformed|orthodox|"
                          r"evangelical|pentecostal|adventist|congregational|unitarian|ame\b|lds|latter|united church|church of christ|"
                          r"ucc\b|moravian|mennonite|brethren|nazarene|assembl(y|ies) of god|disciples of christ|quaker|friends meeting|"
                          r"universalist|christian science|apostolic|holiness|wesleyan|kingdom hall)", re.I)
KIND = {
    "place_of_worship": "worship", "monastery": "convent",
    "school": "school", "college": "college", "university": "college", "hospital": "hospital",
}
# the almanac's types -> the kinds that fit them
FITS = {
    "church": {"worship"}, "chapel": {"worship"}, "cathedral": {"worship"}, "station": {"worship"},
    "mission": {"worship"}, "school": {"school"}, "academy": {"school", "college"},
    "college": {"college", "school"}, "seminary": {"college", "convent"}, "convent": {"convent", "worship", "school"},
    "hospital": {"hospital"}, "asylum": {"school", "convent"}, "house": {"convent"},
}


def fold(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(sts?|ss)\.?(?=\s)|\bste\.?(?=\s)|\bsainte?s?\b|\bsan(ta|to)?\b", " saint ", s)
    s = re.sub(r"'s\b|’s\b", "", s)
    return re.sub(r"[^a-z]+", " ", s)


def dedication(name):
    """The words of a name that say whom it is named for: {'mary'}, {'peter', 'paul'}."""
    words = [w for w in fold(name).split() if w not in GENERIC and len(w) > 1]
    return frozenset(w for w in words if w != "saint")


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


# ── present-day places ──────────────────────────────────────────────────────
# Catholic by denomination, or (with none given) by a name only a Catholic
# place is likely to bear
CATHOLIC_NAME = re.compile(r"^(St\.? |Saint |Ste\.? |Sts\.? |Our Lady|Holy |Sacred |Immaculate|Most Holy|Most Blessed|"
                           r"Blessed |Mercy|Notre Dame|Loyola|Georgetown|Mount Saint|Mount St|Mt\.? St|Visitation|"
                           r"Assumption|Annunciation|Nativity|Epiphany|Transfiguration|Resurrection|Corpus Christi|"
                           r"Christ the King|Basilica|Cathedral of)", re.I)
places = []
for line in open(sys.argv[1], encoding="utf-8"):
    f = json.loads(line)
    t = f["properties"]
    name, amenity = t.get("name"), t.get("amenity")
    if not name or amenity not in KIND:
        continue
    denom = t.get("denomination", "").lower()
    # another church's name rules a place out whatever its tags say; of the
    # Catholic denominations only Rome's (not Old Catholic or Polish National)
    if OTHER_CHURCH.search(name.replace("the Baptist", "").replace("Baptist de", "")):
        continue
    if denom:
        if denom not in ("catholic", "roman_catholic", "roman catholic", "latin", "maronite", "byzantine_catholic", "ukrainian_greek_catholic", "melkite"):
            continue
    elif not CATHOLIC_NAME.search(name) or t.get("religion", "christian") != "christian":
        continue
    ded = dedication(name)
    if not ded:
        continue
    pt = shape(f["geometry"]).representative_point()
    places.append({
        "osm": f"{t['@type']}/{t['@id']}", "name": name, "kind": KIND[amenity], "at": (pt.y, pt.x), "ded": ded,
        "website": t.get("website") or t.get("contact:website") or t.get("url"),
        "wikipedia": t.get("wikipedia"), "start": t.get("start_date"),
        # matched on a saint's name alone: may be another church's
        "unsure": not denom,
    })
base = sys.argv[2] if len(sys.argv) > 2 else None

CELL = 0.25
grid = defaultdict(list)
for p in places:
    grid[(int(p["at"][0] // CELL), int(p["at"][1] // CELL))].append(p)

# ── the almanacs' institutions: every name they bore, their latest place ────
insts = {}
sys.stdin.reconfigure(encoding="utf-8", errors="replace")
for line in sys.stdin:
    inst, year, name, typ, lat, lng = (line.rstrip("\n").split("\t") + [""] * 6)[:6]
    try:
        lat, lng, year = float(lat), float(lng), int(year)
    except ValueError:
        continue
    if not (24 <= lat <= 50 and -125 <= lng <= -66):
        continue
    i = insts.setdefault(inst, {"ded": set(), "year": 0, "at": None, "type": ""})
    # each name it bore, matched separately ("St. Peter's", later "SS. Peter and Paul")
    if dedication(name):
        i["ded"].add(dedication(name))
    if year >= i["year"]:
        i["year"], i["at"], i["type"] = year, (lat, lng), (typ or "").split(",")[0].strip().lower()

out = {}
for inst, i in insts.items():
    if not i["ded"]:
        continue  # "not recorded", "Catholic church": nothing to match on
    gy, gx = int(i["at"][0] // CELL), int(i["at"][1] // CELL)
    found = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for p in grid.get((gy + dy, gx + dx), ()):
                # how much of a name's dedication the place shares, a little less
                # where the place's name adds words ("Saint Peter the Apostle")
                sim = max((len(ded & p["ded"]) / len(ded)) * (0.75 + 0.25 * len(ded & p["ded"]) / len(p["ded"]))
                          for ded in i["ded"])
                if not sim:
                    continue
                d = km(i["at"], p["at"])
                near = max(0.0, 1 - max(0.0, d - 2) / 23)  # full within 2 km, none past 25 km
                fit = 1.0 if p["kind"] in FITS.get(i["type"], {"worship"}) else 0.6
                score = sim * near * fit * (0.85 if p["unsure"] else 1.0)
                if score >= 0.35:
                    found.append((score, d, p))
    if not found:
        continue
    found.sort(key=lambda f: -f[0])
    top = found[:3]
    # strong only where nothing else near comes close
    alone = len(found) == 1 or found[1][0] < 0.7 * found[0][0]
    rows = []
    for n, (score, d, p) in enumerate(top):
        strength = "strong" if score >= 0.8 and n == 0 and alone else "likely" if score >= 0.6 else "possible"
        row = {"osm": p["osm"], "name": p["name"], "kind": p["kind"], "km": round(d, 2), "score": round(score, 2), "strength": strength}
        if p["unsure"]:
            row["denomination"] = "not given"
        for k in ("website", "wikipedia", "start"):
            if p[k]:
                row[k] = p[k]
        rows.append(row)
    out[inst] = rows

json.dump({"osmBase": base, "places": len(places), "institutions": out}, sys.stdout, ensure_ascii=False, separators=(",", ":"))
print(f"[links] {len(places)} present-day places; candidates for {len(out)} of {len(insts)} placed institutions", file=sys.stderr)
