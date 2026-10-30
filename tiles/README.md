# Map tiles

Self-hosted base map for the site's maps, in place of OpenStreetMap / Carto.
Two containers share one volume of tiles:

- **`tiles-build`** is a one-off job. It writes five files into the
  `tiles-data` volume: `base.pmtiles` (North America, zoom 0–10),
  `history.pmtiles` (US states and territories by date, zoom 0–10),
  `transport.pmtiles` (railroads, canals and steamboat rivers by year, zoom 3–12),
  `ohm.pmtiles` (OpenHistoricalMap streets and railways by date, zoom 10–15)
  and `detail.pmtiles` (today's streets around every recorded place, zoom 10–15).
- **`tiles`** is [Martin](https://github.com/maplibre/martin): it serves every
  `.pmtiles` file in that volume as vector tiles, the label fonts and the two
  map styles.

Keeping them apart means restarting or rebuilding the server never rebuilds the
tiles, and new layers are just more files in the same volume.

## Running

```sh
docker compose run --rm tiles-build          # build them all (base, history, ohm, transport, detail)
docker compose run --rm tiles-build base     # base map only: a few minutes
docker compose run --rm tiles-build history  # boundaries by year only: a minute
docker compose run --rm tiles-build ohm      # streets by year only: a few minutes (fetches the newest planet)
docker compose run --rm tiles-build transport  # railroads, canals, steamboat rivers by year: a few minutes
docker compose run --rm tiles-build detail   # street detail only: reads the database
docker compose up -d --build tiles           # serve them on http://localhost:8092
```

Rebuild the detail after a reseed that adds places (e.g. Alaska's records):
only states not fetched before are downloaded.

Until the first build has run, the server waits and logs a reminder.

| URL | What |
|---|---|
| `/style/almanac-light`, `/style/almanac-dark` | the map styles the client loads (one per site theme) |
| `/base/{z}/{x}/{y}`, `/history/…`, `/transport/…`, `/ohm/…`, `/detail/…` | vector tiles; each name alone is its TileJSON |
| `/font/Old Standard TT Regular/0-255` | label glyphs (`Regular`, `Italic`, `Bold`) |
| `/catalog`, `/health` | what the server has; liveness |

The client reads the server's address from `tilesUrl` in
`client/src/environments/` (`http://localhost:8092` locally). Environments
with no tile server (`null`) fall back to Carto's public base maps.

## What's in the base map

- **Area:** North America west to the antimeridian, with Hawaii cut out (the
  almanacs never cover it). Alaska is in. Canada, Mexico and the Caribbean
  show as context: their land, cities over 50,000 and borders, but not their
  provinces or states.
- **Zoom:** 0–10. MapLibre overzooms beyond that; the street detail takes over from zoom 10 around recorded places (the client allows zoom 15).
- **Layers:** `land`, `lakes`, `rivers`, `boundaries` (national),
  `state_boundaries` and `state_labels` (US only), `places`, `marine_labels`.
- **Sources:**
  - [Natural Earth](https://www.naturalearthdata.com/) 10m, public domain,
    with its North America supplements for rivers and lakes
  - from zoom 7: OpenStreetMap's
    [simplified land polygons](https://osmdata.openstreetmap.de/data/land-polygons.html)
    (ODbL, © OpenStreetMap contributors) for the coastline
  - from zoom 7: [GeoNames](https://www.geonames.org/) `cities1000`
    (CC BY 4.0) for towns. Modern suburbs are dropped: a plain town under
    100,000 within `SUBURB_KM` (30) of a city of 250,000+ is skipped, so a
    metro area shows its city and county seats, not twentieth-century
    municipalities.

## Street detail around recorded places

`build-detail.sh` reads every recorded coordinate from `mysqldb-prod` (inside
the US only: a few records carry mistyped coordinates), snaps them to a grid of
`CELL` = 0.05° cells (~5 km), grows each by `MARGIN` = 1 cell, and unions them
into one clip area (`make-area.py`). `pick-regions.py` picks the Geofabrik
state extracts that touch it. Each state is downloaded, filtered with osmium to
what the map draws, and deleted, so at most one raw state (~1.3 GB) is on disk;
the filtered states stay in the `tiles-work` volume for the next build
(`REFRESH_OSM=1` fetches fresh data).

What's drawn, from OpenStreetMap (ODbL, © OpenStreetMap contributors):

| Layer | Contents | From zoom |
|---|---|---|
| `roads` | `kind`: major (motorway, trunk, primary) / secondary (secondary, tertiary) / minor (residential and other streets), `name` | 10 / 11 / 12 |
| `rail` | railways (not in tunnels) | 11 |
| `waterways` | rivers and canals; streams | 10; 13 |
| `water` | water areas (river banks, ponds, reservoirs) | 10 |
| `green` | `kind`: park / cemetery, `name` | 12 |

No buildings or points of interest: they are modern and would compete with
the data.

## Boundaries by year

A map given a year (the dashboards' year controls, a record page's year)
draws the states and territories **in force on 1 January of that year**, since
each almanac was compiled at the turn of its year, instead of today's state
lines, borders and state names. All land is then tinted as foreign and the
United States of that day (its states, territories and the District) is laid
over it in paper, so the national border falls where it was: Mexico reaches
the 42nd parallel before 1848, Texas is a republic from 1836 to 1845, Oregon
Country is jointly held until 1846. States are named in italic capitals,
territories and other areas (Texas Republic, Oregon Country, Indian Territory,
unorganized federal territory) in italic lower case, the neighbouring
countries in spaced capitals under their names of the time. A map showing all
years keeps today's lines. The client side is map-vis' `[year]` input.

The neighbours' names and dates are ours, not the Newberry's (in
`history-features.py`): New Spain to 27 September 1821, then Mexico; British
North America to 14 July 1870 (Rupert's Land joined Canada on the 15th), the
Dominion of Canada from 1 July 1867; Russian America to 18 October 1867.
Their land is today's coastline (Natural Earth / OpenStreetMap), tinted; only
the US side of each border is dated.

| Layer | Contents |
|---|---|
| `states` | one outline per version of a state or territory: `name`, `kind` (state / territory / district / other), `from` and `to` (the days it was in force, `yyyymmdd` integers, both inclusive) |
| `state_labels` | one label point per version (the point deepest inside its largest piece), same properties plus `area` (square degrees, for label priority); plus the neighbouring countries (`kind` nation) |

### Provenance

- **Dataset:** *U.S. Historical States and Territories* (Generalized .0001
  deg), the national state-and-territory file of the **Atlas of Historical
  County Boundaries** (AHCB), a project of the Dr. William M. Scholl Center for
  American History and Culture at the Newberry Library, Chicago.
- **Preferred citation** (from the dataset's metadata, for the .0001° file we
  use): Siczewicz, Peter. *U.S. Historical States and Territories (Generalized
  .0001 deg).* Emily Kelley, digital comp. Dataset. *Atlas of Historical County
  Boundaries*, ed. by John H. Long. Chicago: The Newberry Library, 2011.
  Available online from <https://publications.newberry.org/ahcb/>.
- **What it records:** every change to a state's or territory's boundary from
  3 September 1783 to 31 December 2000, each with its start and end date, the
  legal source of the change and a note on it, compiled from the session laws,
  statutes and other primary sources. The build keeps only the name, type and
  dates; the notes and citations stay in the original.
- **File:** `US_AtlasHCB_StateTerr_Gen0001.zip` from the AHCB's
  [United States downloads](https://publications.newberry.org/ahcb/pages/United_States.html)
  (shapefile, WGS 84), generalized to a tolerance of 0.0001° (about 10 m),
  which is plenty at the zooms these lines are drawn. Downloaded by the build
  on first run (override with `AHCB_URL`) and cached in `tiles-work`; first
  fetched 29 October 2026.
- **Changes made here:** Hawaii is dropped; the fields are reduced and renamed
  as above; label points are computed; tippecanoe simplifies the outlines per
  zoom (shared borders identically).
- **Licence:** the download ships under
  [Creative Commons BY-NC-SA 2.5](https://creativecommons.org/licenses/by-nc-sa/2.5/)
  (attribution, non-commercial, share-alike), so `history.pmtiles` carries the
  same terms. The maps credit it in their (i) line whenever these layers show.
  (A 2019 donation of the AHCB shapefiles to the Library of Congress is reported
  to have released them as CC0; we have not found that release at a primary
  source, so we follow the licence in the file.)

## Streets by year

At street zoom, a map given a year also draws the streets and railways that
existed on 1 January of that year, in ink, wherever OpenHistoricalMap has
mapped them; today's streets fade to a ghost underneath and their names are
hidden (streets were renamed, so today's names would contradict the
historical ones). Where nobody has mapped a city's past yet, only the faded
modern plan shows: the map does not guess.

| Layer | Contents | From zoom |
|---|---|---|
| `roads` | `kind`: major (motorway, trunk, primary) / secondary (secondary, tertiary) / minor (residential and other streets) / alley (service), `name` as of that version, `from`, `to` | 10 / 11 / 12 / 14 |
| `rail` | `kind`: rail / tram (horsecars and streetcars included), `from`, `to` | 11 |

### Provenance

- **Dataset:** [OpenHistoricalMap](https://www.openhistoricalmap.org/) (OHM),
  a volunteer-built, OpenStreetMap-style database of places through time, in
  which each street (and each renaming or rebuilding of it) is a way carrying
  `start_date` and `end_date` tags.
- **File:** the newest daily planet snapshot,
  `planet/planet-YYMMDD_HHMM.osm.pbf` (~1.3 GB), listed in the
  [planet bucket](https://planet.openhistoricalmap.org/) and fetched through its
  CDN. The snapshot used is named in the tiles' TileJSON description (`/ohm`);
  the first build used `planet-261029_0000`, taken 29 October 2026. Each build
  takes the newest snapshot, so rebuild to pick up new mapping.
- **Changes made here:** cut to the US (`OHM_BBOX`, Hawaii below it), kept
  only `highway` and `railway` ways, reduced to a road or rail kind, the name
  and the dates. Dates are read leniently (`1850`, `1850-05`, `1850-05-12`,
  `~1850`, `1850s`): a start counts from the first day it can mean, an end to
  the last. **Undated ways are left out**, since they can't be placed in time.
- **Coverage** is uneven and is the volunteers', not ours: in October 2026,
  sampled tiles had hundreds of streets in use in 1880 in lower Manhattan and
  Cincinnati, and a few dozen in central Boston, Chicago, St. Louis and New
  Orleans. Errors and gaps should be fixed in OpenHistoricalMap itself, then
  rebuilt.
- **Licence:** OHM data is dedicated to the public domain under
  [CC0](https://www.openhistoricalmap.org/copyright), apart from the few
  features carrying their own `license=*` tag; OHM asks for credit as a
  courtesy, which the maps give in their (i) line whenever these layers show.

## Railroads, canals and steamboat rivers by year

A map given a year also draws the transport network of that year: railroads
as an ink line (with paper ties from zoom 7, the engraved railway symbol),
canals in water blue, and rivers steamboats ran on as a dotted blue line. They
stop at zoom 12: the lines were digitised from small-scale maps and would sit
off the real streets closer in, where OpenHistoricalMap's rail takes over.

| Layer | Contents |
|---|---|
| `transport` | `kind` (rail / canal / steamboat), `name` (the railroad company, canal or river), `from`, `to` (`yyyymmdd`, as `history.pmtiles`) |

### Provenance

- **Datasets:** Jeremy Atack's historical transportation GIS databases,
  Vanderbilt University
  ([downloads](https://my.vanderbilt.edu/jeremyatack/data-downloads/)):
  - *Historical Geographic Information Systems (GIS) database of U.S.
    Railroads, 1826–1911* (May 2016; revised 31 October 2023, re-dating and
    relocating the transcontinental railroads),
    `RR1826-1911Modified103123.zip`
  - *Historical GIS database of Nineteenth Century U.S. Canals* (March 2017),
    `19thC_Canals_March2017.zip`
  - *Historical GIS database of Steamboat-Navigated Rivers* (2015),
    `SteamboatNavigatedRiverContigUSAprojection.zip`
  - method: Atack, "Creating Historical Transportation Shapefiles of
    Navigable Rivers, Canals and Railroads for the United States Before World
    War I" (on the same page).
- **Dates:** a railroad segment carries the year it was in operation by
  (`InOpBy`), taken from dated railroad maps, so dates come in survey steps
  (1830, 1835, 1840, 1845, 1850, 1852 … 1861, 1863, 1868, 1872 …) and a line
  appears at the first survey that shows it, which can be a few years after it
  opened. Railroads never close in the data. Canals carry the years they
  opened and closed, rivers the years steamboats ran on them (2100 = still in
  use). A year counts from 1 January; a closing year to the end of the year
  before.
- **Changes made here:** reprojected from USA Contiguous Albers to WGS 84;
  reduced to kind, name and dates; simplified per zoom by tippecanoe.
- **Licence:** none is stated. The files are offered for free download with a
  suggested citation, which the maps' credit line and this README give. Atack
  asks to be told of corrections.

## The styles

`styles/almanac-light.json` and `almanac-dark.json` are generated by
`make-styles.py`: one layer list, two palettes, following the site's design
(white paper, ink linework, italic Old Standard TT names, no colour of its
own). Edit the script, not the JSON, then:

```sh
python3 tiles/make-styles.py && docker compose up -d --build tiles
```

What a layer does on a map set to a year is in its
`metadata["almanac:dated"]`: `"show"` (a dated layer: hidden until a year is
set, then filtered to that day; its filter must start
`["all", <from test>, <to test>, …]`), `"hide"` (today's borders, state names
and street names) or an opacity to fade to (today's streets and rail). The
client's map-vis applies whatever the style says, so new dated layers need no
client change.

Labels use Old Standard TT (OFL), the site's display face; Martin serves the
glyphs straight from the TTFs. Libre Franklin isn't used on the map because it
is only published as a variable font.

## Files

```
tiles/
  Dockerfile        builder target (tippecanoe + gdal + the script) and server target (Martin + fonts + styles)
  build.sh          the build job's entry point: base | detail | history | ohm | transport | all
  build-tiles.sh    Natural Earth / OSM / GeoNames → clip (ogr2ogr) → jq → tippecanoe → base.pmtiles
  build-detail.sh   recorded places → area → Geofabrik states → osmium → jq → tippecanoe → detail.pmtiles
  build-history.sh  Newberry AHCB states and territories → ogr2ogr → history-features.py → tippecanoe → history.pmtiles
  history-features.py  dated outlines + label points (and the neighbours' names), Hawaii dropped
  build-ohm.sh      newest OpenHistoricalMap planet → osmium (US, streets, rail) → ohm-features.py → tippecanoe → ohm.pmtiles
  ohm-features.py   OHM dates → from/to days; road and rail kinds; undated ways dropped
  build-transport.sh  Atack railroads, canals, steamboat rivers → ogr2ogr (dates as from/to) → tippecanoe → transport.pmtiles
  make-area.py      grid cells of recorded places → one clip polygon
  pick-regions.py   the Geofabrik state extracts that touch that polygon
  entrypoint.sh     fills TILES_PUBLIC_URL into the styles, waits for tiles, starts Martin on /data
  make-styles.py    writes styles/almanac-{light,dark}.json
  styles/
```

Server environment: `TILES_PUBLIC_URL` (where browsers reach it; written into
the styles), `ROUTE_PREFIX` (when a proxy passes a path prefix through),
`CACHE_SIZE_MB` (default 128).
