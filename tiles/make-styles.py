#!/usr/bin/env python3
"""Writes the two map styles, styles/almanac-light.json and almanac-dark.json.

One layer list, two palettes, so light and dark never drift apart. The look
follows the site's "Directory" design (client/src/styles.scss): white paper,
ink linework, hairline state lines, italic display-face names, and no colour
of its own, so the data drawn on top is the only strong colour on the map.

Run it after changing a colour or a layer, then rebuild the tiles server image:
    python3 tiles/make-styles.py && docker compose up -d --build tiles
"""
import json
from pathlib import Path

FONT = "Old Standard TT"
REGULAR, ITALIC, BOLD = [f"{FONT} Regular"], [f"{FONT} Italic"], [f"{FONT} Bold"]

PALETTES = {
    "light": {
        "land": "#ffffff", "water": "#dfe6ea", "river": "#a9bcc6", "coast": "#9a9384",
        "state": "#b9b1a3", "border": "#5f5a50",
        "ink": "#1b1a17", "ink2": "#3d3a33", "ink3": "#5f5a50", "water_label": "#56707e",
        "dot": "#3d3a33",
        "road_minor": "#dcd7cc", "road_secondary": "#c4bcae", "road_major": "#9a9384",
        "rail": "#8a8478", "green": "#f3f1ea", "cemetery": "#ebe9e0",
        "foreign": "#ebe8e0", "old_road": "#5f5a50",
    },
    "dark": {
        "land": "#14130f", "water": "#1c2227", "river": "#3b4b55", "coast": "#5a5548",
        "state": "#4a463c", "border": "#a39c8d",
        "ink": "#ece7dc", "ink2": "#cfc8b9", "ink3": "#a39c8d", "water_label": "#7f97a4",
        "dot": "#cfc8b9",
        "road_minor": "#2e2c26", "road_secondary": "#403d35", "road_major": "#625d52",
        "rail": "#7a7466", "green": "#1a1915", "cemetery": "#1e1d19",
        "foreign": "#22211c", "old_road": "#b5ae9f",
    },
}

ATTRIBUTION = (
    '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'
    ' · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'
    ' · <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>'
)


# What a layer does on a map set to a year (map-vis applies it): "show" (a
# dated layer, hidden otherwise), "hide" (today's lines and names), or an
# opacity to fade to (today's streets, under the historical ones).
SHOW, HIDE = {"almanac:dated": "show"}, {"almanac:dated": "hide"}


def fade(opacity):
    return {"almanac:dated": opacity}


# A dated layer's filter until a map picks a date: matches nothing. It is
# always ["all", <from test>, <to test>, ...more]: map-vis replaces the two
# date tests with the year's day and keeps the rest.
NO_DATE = ["all", ["<=", ["get", "from"], 0], [">=", ["get", "to"], 0]]

# the historical boundaries' provenance, shown in the map's (i) credit line
# whenever a map is set to a year (see README "Boundaries by year")
HISTORY_ATTRIBUTION = (
    'Boundaries by year: <a href="https://publications.newberry.org/ahcb/" target="_blank" rel="noopener">'
    'Atlas of Historical County Boundaries</a>, ed. John H. Long, The Newberry Library'
    ' (<a href="https://creativecommons.org/licenses/by-nc-sa/2.5/" target="_blank" rel="noopener">CC BY-NC-SA 2.5</a>)'
)


OHM_ATTRIBUTION = (
    'Streets by year: <a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener">'
    '© OpenHistoricalMap contributors</a> (CC0)'
)


def zoom(*stops):
    return ["interpolate", ["linear"], ["zoom"], *stops]


def layers(c):
    halo = c["land"]
    return [
        {"id": "water", "type": "background", "paint": {"background-color": c["water"]}},
        {"id": "land", "type": "fill", "source": "base", "source-layer": "land",
         "paint": {"fill-color": c["land"], "fill-antialias": False}},
        # A dated map tints all land as foreign, then lays the United States of
        # that day over it in paper, so the border falls wherever it was then
        # (Mexico's north before 1848, Texas as a republic) rather than today.
        {"id": "history-foreign", "metadata": SHOW, "type": "fill", "source": "base", "source-layer": "land",
         "layout": {"visibility": "none"},
         "paint": {"fill-color": c["foreign"], "fill-antialias": False}},
        {"id": "history-fill", "metadata": SHOW, "type": "fill", "source": "history", "source-layer": "states",
         "layout": {"visibility": "none"},
         # the United States proper: not the Texas Republic or Oregon Country
         "filter": [*NO_DATE, ["match", ["get", "kind"], ["state", "territory", "district"], True, False]],
         "paint": {"fill-color": c["land"], "fill-antialias": False}},
        # an engraved coastline: one fine ink line around the land
        {"id": "coast", "type": "line", "source": "base", "source-layer": "land",
         "paint": {"line-color": c["coast"], "line-width": zoom(2, 0.3, 8, 0.7)}},
        {"id": "lakes", "type": "fill", "source": "base", "source-layer": "lakes",
         "paint": {"fill-color": c["water"], "fill-outline-color": c["coast"]}},
        {"id": "rivers", "type": "line", "source": "base", "source-layer": "rivers",
         "layout": {"line-cap": "round", "line-join": "round"},
         "paint": {"line-color": c["river"],
                   "line-width": zoom(3, ["case", ["<=", ["get", "rank"], 4], 0.7, 0.3],
                                      8, ["case", ["<=", ["get", "rank"], 4], 1.6, 0.8]),
                   # Natural Earth's lines are too coarse at street zoom, where
                   # the detail layer draws the real banks
                   "line-opacity": zoom(10, 1, 11, 0)}},
        # ── street detail around recorded places (zoom 10+; detail.pmtiles) ──
        {"id": "detail-green", "type": "fill", "source": "detail", "source-layer": "green",
         "paint": {"fill-color": ["match", ["get", "kind"], "cemetery", c["cemetery"], c["green"]],
                   "fill-outline-color": c["road_minor"]}},
        {"id": "detail-water", "type": "fill", "source": "detail", "source-layer": "water",
         "paint": {"fill-color": c["water"]}},
        {"id": "detail-waterways", "type": "line", "source": "detail", "source-layer": "waterways",
         "layout": {"line-cap": "round", "line-join": "round"},
         "paint": {"line-color": c["river"],
                   "line-width": zoom(10, ["match", ["get", "kind"], "stream", 0.4, 1], 15, ["match", ["get", "kind"], "stream", 1.2, 3])}},
        {"id": "detail-rail", "metadata": fade(0.35), "type": "line", "source": "detail", "source-layer": "rail",
         "paint": {"line-color": c["rail"], "line-width": zoom(11, 0.5, 15, 1.2), "line-dasharray": [4, 2]}},
        {"id": "detail-roads", "metadata": fade(0.35), "type": "line", "source": "detail", "source-layer": "roads",
         "layout": {"line-cap": "round", "line-join": "round"},
         # main and secondary streets lead; motorways (modern) stay as quiet
         # as side streets, so the older street plan reads first
         "paint": {"line-color": ["match", ["get", "kind"], "major", c["road_major"],
                                  "secondary", c["road_secondary"], c["road_minor"]],
                   "line-width": zoom(10, ["match", ["get", "kind"], "major", 0.8, "secondary", 0.5, "motorway", 0.5, 0.3],
                                      13, ["match", ["get", "kind"], "major", 1.6, "secondary", 1.2, "motorway", 1.2, 0.8],
                                      15, ["match", ["get", "kind"], "major", 3, "secondary", 2.5, "motorway", 2, 2])}},
        # ── the streets and railways of one date (ohm.pmtiles), in ink over
        # today's, which fade; coverage is what OpenHistoricalMap has
        {"id": "ohm-rail", "metadata": SHOW, "type": "line", "source": "ohm", "source-layer": "rail",
         "layout": {"visibility": "none"}, "filter": NO_DATE,
         "paint": {"line-color": c["old_road"], "line-width": zoom(11, 0.6, 15, 1.4),
                   "line-dasharray": [4, 2]}},
        {"id": "ohm-roads", "metadata": SHOW, "type": "line", "source": "ohm", "source-layer": "roads",
         "layout": {"visibility": "none", "line-cap": "round", "line-join": "round"}, "filter": NO_DATE,
         "paint": {"line-color": c["old_road"],
                   "line-width": zoom(10, ["match", ["get", "kind"], "major", 0.8, "secondary", 0.6, 0.4],
                                      13, ["match", ["get", "kind"], "major", 1.6, "secondary", 1.2, "alley", 0.5, 0.9],
                                      15, ["match", ["get", "kind"], "major", 3, "secondary", 2.4, "alley", 1, 1.8])}},
        {"id": "state-boundaries", "metadata": HIDE, "type": "line", "source": "base", "source-layer": "state_boundaries",
         "paint": {"line-color": c["state"], "line-width": zoom(3, 0.4, 8, 1)}},
        # ── the states and territories of one date (history.pmtiles) ──
        # Hidden here: a map given a year shows these in place of today's state
        # lines, borders and names, filtered to that year (map-vis, HISTORY_LAYERS).
        {"id": "history-lines", "metadata": SHOW, "type": "line", "source": "history", "source-layer": "states",
         "layout": {"visibility": "none", "line-join": "round"},
         "filter": NO_DATE,
         "paint": {"line-color": c["border"], "line-width": zoom(3, 0.5, 8, 1.1)}},
        {"id": "boundaries", "metadata": HIDE, "type": "line", "source": "base", "source-layer": "boundaries",
         "layout": {"line-join": "round"},
         "paint": {"line-color": c["border"], "line-width": zoom(2, 0.6, 8, 1.4),
                   "line-dasharray": [6, 2, 1, 2]}},
        {"id": "place-dots", "type": "circle", "source": "base", "source-layer": "places",
         "minzoom": 4,
         "paint": {"circle-color": c["dot"],
                   "circle-radius": zoom(4, ["case", ["==", ["get", "capital"], 1], 2, 1.3],
                                         10, ["case", ["==", ["get", "capital"], 1], 3, 2]),
                   "circle-stroke-color": halo, "circle-stroke-width": 0.8}},
        {"id": "marine-labels", "type": "symbol", "source": "base", "source-layer": "marine_labels",
         "layout": {"text-field": ["get", "name"], "text-font": ITALIC,
                    "text-size": zoom(2, 11, 6, 15), "text-letter-spacing": 0.12,
                    "text-max-width": 8, "symbol-sort-key": ["get", "rank"]},
         "paint": {"text-color": c["water_label"]}},
        {"id": "lake-labels", "type": "symbol", "source": "base", "source-layer": "lakes",
         "minzoom": 5,
         "layout": {"text-field": ["get", "name"], "text-font": ITALIC,
                    "text-size": zoom(5, 11, 9, 14), "text-max-width": 7},
         "paint": {"text-color": c["water_label"], "text-halo-color": c["water"], "text-halo-width": 1}},
        {"id": "river-labels", "type": "symbol", "source": "base", "source-layer": "rivers",
         "minzoom": 6, "maxzoom": 11,
         "layout": {"symbol-placement": "line", "text-field": ["get", "name"], "text-font": ITALIC,
                    "text-size": zoom(6, 11, 10, 13), "symbol-spacing": 400},
         "paint": {"text-color": c["water_label"], "text-halo-color": halo, "text-halo-width": 1.2}},
        {"id": "detail-road-labels", "metadata": HIDE, "type": "symbol", "source": "detail", "source-layer": "roads",
         "minzoom": 14,
         "layout": {"symbol-placement": "line", "text-field": ["get", "name"], "text-font": REGULAR,
                    "text-size": zoom(14, 10, 15, 12), "symbol-spacing": 300},
         "paint": {"text-color": c["ink3"], "text-halo-color": halo, "text-halo-width": 1.5}},
        {"id": "ohm-road-labels", "metadata": SHOW, "type": "symbol", "source": "ohm", "source-layer": "roads",
         "minzoom": 14, "filter": NO_DATE,
         "layout": {"visibility": "none", "symbol-placement": "line", "text-field": ["get", "name"],
                    "text-font": REGULAR, "text-size": zoom(14, 10, 15, 12), "symbol-spacing": 300},
         "paint": {"text-color": c["ink2"], "text-halo-color": halo, "text-halo-width": 1.5}},
        {"id": "detail-green-labels", "type": "symbol", "source": "detail", "source-layer": "green",
         "minzoom": 15,
         "layout": {"text-field": ["get", "name"], "text-font": ITALIC, "text-size": 11, "text-max-width": 7},
         "paint": {"text-color": c["ink3"], "text-halo-color": halo, "text-halo-width": 1.2}},
        # a year's states in italic capitals, as below; territories and other
        # areas (Texas Republic, Oregon Country) in italic lower case; the
        # neighbouring countries widely spaced
        {"id": "history-labels", "metadata": SHOW, "type": "symbol", "source": "history", "source-layer": "state_labels",
         "maxzoom": 8,
         "layout": {"visibility": "none",
                    "text-field": ["get", "name"], "text-font": ITALIC,
                    "text-size": zoom(3, 10, 7, 15),
                    "text-transform": ["match", ["get", "kind"], ["state", "nation"], "uppercase", "none"],
                    "text-letter-spacing": ["match", ["get", "kind"], "nation", 0.3, "state", 0.18, 0.04],
                    "text-max-width": 8,
                    # big areas claim their place first; small ones fit in where there is room
                    "symbol-sort-key": ["-", 0, ["get", "area"]]},
         "filter": NO_DATE,
         "paint": {"text-color": c["ink3"], "text-halo-color": halo, "text-halo-width": 1.5}},
        # state names: italic capitals, spaced, as the almanacs set them
        {"id": "state-labels", "metadata": HIDE, "type": "symbol", "source": "base", "source-layer": "state_labels",
         "maxzoom": 8,
         "layout": {"text-field": ["step", ["zoom"], ["get", "abbr"], 4, ["get", "name"]],
                    "text-font": ITALIC, "text-size": zoom(3, 10, 7, 15),
                    "text-transform": "uppercase", "text-letter-spacing": 0.18, "text-max-width": 8},
         "paint": {"text-color": c["ink3"], "text-halo-color": halo, "text-halo-width": 1.5}},
        {"id": "place-labels", "type": "symbol", "source": "base", "source-layer": "places",
         "minzoom": 4,
         "layout": {"text-field": ["get", "name"],
                    "text-font": ["case", ["==", ["get", "capital"], 1], ["literal", BOLD], ["literal", REGULAR]],
                    "text-size": zoom(4, ["case", ["<=", ["get", "rank"], 4], 13, 11],
                                      10, ["case", ["<=", ["get", "rank"], 6], 17, 14]),
                    "text-anchor": "left", "text-offset": [0.5, 0], "text-max-width": 8,
                    "symbol-sort-key": ["get", "rank"]},
         "paint": {"text-color": c["ink"], "text-halo-color": halo, "text-halo-width": 1.5}},
    ]


def style(name, c):
    return {
        "version": 8,
        "name": f"Catholic Almanacs — {name}",
        "metadata": {"description": "North American base map for the Catholic Almanacs (Hawaii excluded). "
                                    "Generated by tiles/make-styles.py; ${TILES_PUBLIC_URL} is filled in "
                                    "when the tile server starts."},
        "sources": {
            "base": {"type": "vector", "url": "${TILES_PUBLIC_URL}/base", "attribution": ATTRIBUTION},
            # built by `tiles-build detail`; until then its layers simply draw nothing
            "detail": {"type": "vector", "url": "${TILES_PUBLIC_URL}/detail"},
            # built by `tiles-build history`
            "history": {"type": "vector", "url": "${TILES_PUBLIC_URL}/history",
                        "attribution": HISTORY_ATTRIBUTION},
            # built by `tiles-build ohm`
            "ohm": {"type": "vector", "url": "${TILES_PUBLIC_URL}/ohm", "attribution": OHM_ATTRIBUTION},
        },
        "glyphs": "${TILES_PUBLIC_URL}/font/{fontstack}/{range}",
        "layers": layers(c),
    }


if __name__ == "__main__":
    out = Path(__file__).parent / "styles"
    out.mkdir(exist_ok=True)
    for name, palette in PALETTES.items():
        path = out / f"almanac-{name}.json"
        path.write_text(json.dumps(style(name, palette), indent=2, ensure_ascii=False) + "\n")
        print("wrote", path)
