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
    },
    "dark": {
        "land": "#14130f", "water": "#1c2227", "river": "#3b4b55", "coast": "#5a5548",
        "state": "#4a463c", "border": "#a39c8d",
        "ink": "#ece7dc", "ink2": "#cfc8b9", "ink3": "#a39c8d", "water_label": "#7f97a4",
        "dot": "#cfc8b9",
    },
}

ATTRIBUTION = (
    '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'
    ' · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'
    ' · <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>'
)


def zoom(*stops):
    return ["interpolate", ["linear"], ["zoom"], *stops]


def layers(c):
    halo = c["land"]
    return [
        {"id": "water", "type": "background", "paint": {"background-color": c["water"]}},
        {"id": "land", "type": "fill", "source": "base", "source-layer": "land",
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
                                      8, ["case", ["<=", ["get", "rank"], 4], 1.6, 0.8])}},
        {"id": "state-boundaries", "type": "line", "source": "base", "source-layer": "state_boundaries",
         "paint": {"line-color": c["state"], "line-width": zoom(3, 0.4, 8, 1)}},
        {"id": "boundaries", "type": "line", "source": "base", "source-layer": "boundaries",
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
         "minzoom": 6,
         "layout": {"symbol-placement": "line", "text-field": ["get", "name"], "text-font": ITALIC,
                    "text-size": zoom(6, 11, 10, 13), "symbol-spacing": 400},
         "paint": {"text-color": c["water_label"], "text-halo-color": halo, "text-halo-width": 1.2}},
        # state names: italic capitals, spaced, as the almanacs set them
        {"id": "state-labels", "type": "symbol", "source": "base", "source-layer": "state_labels",
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
        "sources": {"base": {"type": "vector", "url": "${TILES_PUBLIC_URL}/base", "attribution": ATTRIBUTION}},
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
