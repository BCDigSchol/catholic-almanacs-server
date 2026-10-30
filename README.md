# Catholic Almanacs Database

A web application for exploring the people, institutions and dioceses of the
nineteenth-century American Catholic Church, reconstructed from the annual
*Catholic Almanac* directories.

Each year's almanac listed the Church's dioceses, the churches, schools,
convents, colleges, hospitals and charities within them, and the clergy and
religious who served there. Read one year at a time, those lists are a
directory. Read across many years, they show how the Church grew, moved west,
changed shape, and moved its people from post to post. The database turns the
lists into linked records, and the site lets researchers and general readers
browse them, follow a single parish or priest through time, and see the whole
collection as maps, networks and charts.

- **Deployment:** the production build is served under
  `/ds/catholic-almanacs/` (the development build under
  `/ds/catholic-almanacs-dev/`) and talks to the API at
  `https://praetor.bc.edu/{production,development}/api/`.
- **Coverage:** the records currently cover about 6,000 institutions and 7,200
  people, from 1833 to 1838 and from 1864 to 1870. The almanac was not
  published in 1862 or 1863, and further years are being transcribed.

---

## Contents

- [How the records work](#how-the-records-work)
- [Browsing and search](#browsing-and-search)
- [Record pages](#record-pages)
- [Dashboards](#dashboards)
- [Networks](#networks)
- [Maps](#maps)
- [Exports and citation](#exports-and-citation)
- [Architecture](#architecture)
- [Running locally](#running-locally)
- [Data sources and licences](#data-sources-and-licences)

---

## How the records work

The data is **temporal**: a record is a stable identity, and each almanac
year's listing of it is kept separately.

- **Institutions and people are stable identities.** A parish or college has
  one record with a permanent ID (for example `stl.mo.0148`: diocese, state,
  number), however its name, type or diocese changed over the years.
- **Each almanac year is its own entry.** What the almanac printed about an
  institution in a given year (its name, type, place, diocese, and the clergy
  listed there) is kept as that year's entry, so a church that was renamed,
  changed dioceses or became a cathedral keeps its whole history.
- **People are linked to the institutions they served, year by year**, either
  as residents or as visiting clergy who attended a church from elsewhere.
- **Names are kept as printed.** Spellings, titles and abbreviations vary
  between years. An institution listed without a name ("not recorded") is
  shown as "Unnamed church", "Unnamed school" and so on.
- **Places are approximate.** Points are mapped from the town, county and state
  the almanac gave, so they mark the place, not a building.

## Browsing and search

- **Header search** finds institutions and people by name from any page.
  Search ignores case and accents.
- **Browse institutions** (`/institutions`) and **browse people** (`/people`)
  list every record, as of its latest year. You can filter by name, diocese,
  state, type, religious order and years, and sort by name, year or diocese.
  Every filter, sort and page lives in the URL, so a filtered list can be
  bookmarked or shared.

## Record pages

Every institution and person has a record page (`/institutions/:id`,
`/people/:id`).

- **Year tabs** pick one almanac year (kept in the URL as `?year=`) or show all
  years merged. The facts, the people listed and the map all follow the year
  chosen.
- **A full-width map band** sits above the facts, drawn on the base map of the
  year chosen (see [Maps](#maps)):
  - *Institution pages* show the institution's circuit: the stations it
    served, the churches whose priests served it, its neighbours within about
    50 km, and its diocese's cathedral.
  - *Person pages* show the career as a path through the resident posts in
    order, labelled with years, with the places visited drawn separately.
  - On institution pages the band can also show the institution's network and
    its tree of related institutions.
- **Clergy over time** (institution pages): a ladder with one row per person
  and one column per almanac year. It shows succession and overlap at a
  glance, with the gap between almanac runs marked, the chosen year picked
  out, and where each pastor came from and went next.
- **Career** (person pages): the same ladder, with one row per post.
- **Cite** gives a copyable citation of the record as viewed.

## Dashboards

`/dashboards` collects the analytical views. They share one framework:

- Every control is kept in the URL, so any view can be bookmarked or linked.
- Each view opens with a written takeaway.
- Each view has a "How this is built" note on its method.
- Filters sit inline on wide screens and in a sheet on phones.
- Time axes give each almanac year an equal slot and mark the 1838–1864 gap,
  rather than stretching across empty decades.

**Start here**

- **The Almanacs at a Glance:** one coordinated board over the whole
  collection. The map, function and type bars, diocese ranking and year
  timeline all filter each other: click anything and every other panel
  recounts, with a live summary strip and removable filter chips. It can count
  institutions or people.
- **Coverage, the Shape of the Data:** a diocese-by-year grid showing which
  sees were recorded in which years. It marks where a see existed but had no
  records yet, where it did not exist yet, and known gaps such as the Civil
  War years. Beside it is a map of where records concentrate.

**Geography**

- **The Spread of the Church:** an animated map of institutions spreading west
  year by year, with the Church's centre of gravity drifting with them.
- **Diocese by Diocese:** a map coloured by diocese that you can play through
  the years or narrow to a single see. The dioceses' territories for that year
  are drawn over it, with the chosen see's shaded. A panel lists the records
  listed under one diocese but lying in another's territory, with a CSV for
  checking them.
- **Mission Circuits:** churches and stations with no priest of their own,
  each drawn as an arc from the church that served it. It also shows the share
  of the Church served from afar each year and the largest circuits.
- **Rails and Rivers:** how near each year's institutions stood to the
  railroads, canals and steamboat rivers of that year, mapped and charted over
  time. This tests whether the Church followed the water, then the railroad.

**Change over time**

- **The Shape of the Church:** how the mix of institutions (parishes, schools,
  hospitals, charities) and of the people serving them, down to their titles,
  shifted across the years.
- **Comparing Places:** dioceses, states or years side by side.
- **A Part Against the Whole:** one order, diocese or state against the
  national total, to see which grew faster.

**Connections**

- **Networks:** see [Networks](#networks).
- **Clergy Flows:** where priests went when they moved between posts. Moves
  between dioceses are drawn as arcs between the sees, with tables of who sent
  clergy to whom and which dioceses gained or lost clergy overall. Each move
  is assigned to the diocese as listed that year, so a parish that later
  passed to a new see does not count as a move.
- **Religious Orders:** where the Jesuits, Redemptorists, Vincentians,
  Benedictines, Franciscans, Dominicans and other orders served, year by year.
  It has a map sized by members, a table of dioceses, and a chart comparing
  every order over time. Membership is read from the order initials the
  almanacs printed after a name (S.J., C.SS.R., O.S.B. …). Women's
  congregations are rarely marked that way, so they are mostly missing.

## Networks

The networks page (`/dashboards/networks`) has four views:

| View | What is linked |
|---|---|
| **Institutions** | Institutions that shared clergy or staff in the same year. A **Ties** switch changes this to institutions that clergy **moved between** (one post left, another taken), drawn as arrows. |
| **People** | People listed at the same institution in the same year. |
| **Both** | People linked directly to the institutions they served. |
| **Path** | The path finder (below). |

Tools shared by the network views:

- **Focus on** any institution or person, found through the site search rather
  than only among the nodes drawn. The graph re-centres on its neighbourhood,
  one step, two steps or everything reachable.
- **Largest groups** lists the biggest connected clusters of the whole network
  and opens any of them.
- **The details card** for a clicked node shows:
  - what it is linked to
  - its rank by number of links
  - its rank as a *go-between* (betweenness centrality: how often it lies on
    the shortest route between other nodes)
  - links to focus on it or open its record
- **Graph or map:** the institution network can also be drawn on the map, with
  each institution at its place and the ties as lines between them.
- **Filters** by diocese, state, type, function, role, title, religious order,
  city and years.
- **Downloads:** the network as drawn, as **GEXF** (for Gephi) or **CSV** (a
  nodes file and an edges file). Each download carries the definition of the
  ties, the filters applied, each node's links and betweenness, and a
  citation.

**Path finder**

The Path view (`?view=path&from=<id>&to=<id>`) answers "how are these two
connected?" for any two people or institutions.

- It finds the shortest chain of people between them. Each step is two people
  the almanac listed at the same institution in the same year, whether
  resident or visiting.
- It shows each institution in the chain with its place and the years both
  people were there.
- For example, Boston's and Albany's cathedrals are linked by two priests who
  were both at the Provincial Seminary in Troy in 1869.

## Maps

All maps run on MapLibre GL over a **self-hosted base map** (`tiles/`, served
by [Martin](https://github.com/maplibre/martin)), drawn in the almanacs'
printed style. Maps stay over the contiguous United States.

A map that is given a year shows the country **as it was on 1 January of that
year**:

- **States, territories and the national border** of that date. Land outside
  the United States of the time is tinted, so the Mexican Cession or the
  Oregon Country read as foreign before they were annexed.
- **Railroads, canals and steamboat rivers** in operation that year. Railroads
  are drawn with the engraved cross-tie symbol of period maps, canals in blue,
  and steamboat rivers as dotted blue lines.
- **Diocese territories** of that year, on maps that ask for them (Diocese by
  Diocese). These are a work in progress, fuller in the east.
- **Streets** that existed that year, where OpenHistoricalMap has mapped them.
  Today's streets fade into the background.

The historical layers come from the self-hosted tiles. Builds configured
without a tile server (`tilesUrl: null` in `client/src/environments/`, which
is currently the case for production) fall back to Carto's public base maps
and show today's geography.

Data maps can switch between points, clusters, a heatmap and a binned grid that
refines as you zoom. Maps can also draw arcs between places (circuits, moves,
network ties), labels and highlighted markers. Clicking a point opens its
record for that year.

## Exports and citation

- Network views download as GEXF or CSV with their method and citation (see
  above).
- Record pages have a copyable citation.
- The Export page (where enabled) offers bulk downloads of the data.

## Architecture

| Part | Stack | Where |
|---|---|---|
| Client | Angular 19 (standalone components), d3 v7, MapLibre GL, vis-network | `client/` |
| API | Node.js, Express, Sequelize | `server/` |
| Database | MySQL 5.7 (utf8mb4) | Docker volume |
| Base map | PMTiles built by a one-off job, served by Martin | `tiles/` |

- Every API route is under `/api`. Heavy aggregate endpoints use raw SQL with
  in-process caches.
- The overview, network, path, career and order data are built once per
  process from the database and answered from memory.
- Responses are gzipped.
- `tiles/README.md` documents the tile build, each layer, and its provenance.

## Running locally

The stack runs in Docker Compose. Host ports are deliberately off the defaults
so it can run beside other projects.

| Service | Host port |
|---|---|
| API (production / development data) | 8090 / 8091 |
| MySQL (production / development) | 3317 / 3318 |
| Map tiles (Martin) | 8092 |
| Angular dev server | 4200 |

```bash
docker compose up -d mysqldb-prod nodejs-prod
```

The API image is built from `server/` without a source mount. After changing
server code, rebuild it:

```bash
docker compose up -d --build nodejs-prod
```

Build the map tiles once. The street-detail and transport-distance steps read
the database, so start it first:

```bash
docker compose run --rm tiles-build
```

Then serve them:

```bash
docker compose up -d --build tiles
```

`tiles-build` also takes `base`, `history`, `transport`, `ohm` or `detail` to
rebuild one part. Map styles are generated: edit `tiles/make-styles.py`, not
the JSON.

Run the client against the local API:

```bash
cd client && npm install && npm start
```

Migrations and seeders run with `npm run migrate` in `server/`. Seeding errors
are logged to `server/logs/seed-errors.log`, and `npm run seed:errors`
summarises them.

## Data sources and licences

- **The almanac data and this code** are released under
  [Creative Commons Attribution-NonCommercial-ShareAlike 4.0](LICENSE).
- **Base map:** [Natural Earth](https://www.naturalearthdata.com/) (public
  domain), [OpenStreetMap](https://www.openstreetmap.org/copyright) land
  polygons and street detail (ODbL, © OpenStreetMap contributors), and
  [GeoNames](https://www.geonames.org/) towns (CC BY 4.0).
- **Historical boundaries:** *U.S. Historical States and Territories*, Atlas
  of Historical County Boundaries, Dr. William M. Scholl Center for American
  History and Culture, The Newberry Library (CC BY-NC-SA 2.5).
- **Diocese territories:** drawn at Boston College for this project (in
  progress).
- **Historical streets:**
  [OpenHistoricalMap](https://www.openhistoricalmap.org/copyright) (CC0).
- **Railroads, canals and steamboat rivers:** Jeremy Atack's historical
  transportation GIS databases, Vanderbilt University
  ([downloads](https://my.vanderbilt.edu/jeremyatack/data-downloads/)).

Full citations, dates and caveats for each map dataset are in
[`tiles/README.md`](tiles/README.md), and the maps credit them in their
attribution line.

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).
