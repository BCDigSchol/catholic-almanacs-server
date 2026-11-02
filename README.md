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

## Features at a glance

- **Records you can follow through time:** every institution and person has a
  page with a year-by-year view, a map of its circuit or career, a ladder of
  who served when, and a citation.
- **Dashboards** for the whole collection:
  - an overview where every panel filters the others
  - coverage of the data, and a Data Issues page
  - the Church's spread west, diocese by diocese
  - mission circuits, and distance to railroads, rivers and trails
  - missions and the Native land cessions
  - the Southwest: land taken from Mexico, and Spanish-surnamed clergy
  - languages and congregations
  - the changing mix of institutions and clergy, lifespans and turnover
  - who ran the schools and charities (women's congregations above all), and
    whether they took girls or boys
  - paying and charity: fee-paying and free schools, the charities and whom
    they took in, and what churches were built of
  - clergy flows between dioceses, and religious orders
- **Networks** of institutions and people:
  - ties by serving together or by moving from post to post
  - focus on any record, and the largest groups
  - the network drawn on the map
  - a path finder ("how are these two connected?")
  - each node's ranks by links and as a go-between
  - GEXF and CSV downloads
- **Relief:** every map shades the land by its elevation, so the mountains the
  missionaries crossed, and the plains the railroads ran on, read as such.
- **Maps as of the year shown:** that year's states, counties and borders, railroads,
  canals and steamboat rivers, historical streets and diocese territories, on
  a self-hosted base map in the almanacs' printed style.
- **Data quality tools:**
  - a review queue for people recorded under two ids
  - checks for places, diocese territories, circuits and ids, with downloads
    for the people correcting the transcriptions

---

## Contents

- [Features at a glance](#features-at-a-glance)
- [How the records work](#how-the-records-work)
- [Browsing and search](#browsing-and-search)
- [Record pages](#record-pages)
- [County pages](#county-pages)
- [Metro areas](#metro-areas)
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

- **Header search** finds institutions, people and places by name from any
  page. Typing "Kane" lists Kane County, Illinois (with its number of
  institutions) above the people named Kane, and a county opens its county
  page. The selector beside it limits the search to institutions, people or
  places.
- **Note search:** the institution browser's "Notes mention" filter searches
  the almanacs' notes. Every word must appear, and "quoted phrases" stay
  together. Each result shows the passage that matched, with the words
  highlighted.
  Search ignores case and accents.
- **Browse institutions** (`/institutions`) and **browse people** (`/people`)
  list every record, as of its latest year. You can filter by name, diocese,
  state, type, religious order and years, and sort by name, year or diocese.
  Every filter, sort and page lives in the URL, so a filtered list can be
  bookmarked or shared. "County as it was" finds institutions by the
  historical county they lay in ("Noble" or "Noble, Ohio"), whatever the
  transcription called it.

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
- **County and land:** institution pages give the county the place lay in
  that year (linked to its county page) and, where Royce mapped it, the Indian
  land cession(s) it stood on, with the nation, date and treaty. Land taken
  from Mexico says how and when (annexed with Texas, the Mexican Cession).
- **Today** (institution pages): where the institution is today, with its
  website, once a reviewer has confirmed it, and always a web search for it.
- **Cite** gives a copyable citation of the record as viewed.

## County pages

Every historical county with records has a page (`/places/county/:id`, e.g.
`/places/county/ohs_noble`). It shows the county shaded on a map as it stood
in its last listed year, with:
- every institution the almanacs placed in it, with years and dioceses
- the clergy and religious listed there
- the dioceses it belonged to
- the land cessions its institutions stood on

Record pages link to it.

## Metro areas

The 22 cities of 50,000 or more at the 1870 census each have a metro area page
(`/places/metro/:id`, e.g. `/places/metro/boston-ma`). Each page gathers
everything the almanacs recorded in the city's county and the counties around
it, as county pages do, with the counties shaded on the map and the city's
population at each census from 1830 to 1870.

The boundaries are drawn for this site and are anachronistic: the census
defined no metropolitan areas before 1910. A metro is the county holding the
city plus each county with a quarter or more of its area within 20 miles, as
the lines stood in 1870, with each county given to the nearer city (Brooklyn
and Jersey City are counted with New York, Allegheny with Pittsburgh). Every
metro page says so at the top. The areas are defined in
`server/data/metros.csv`, which can be edited by hand. Record pages and county
pages link to their metro, and the header search finds metros by city name.

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

- **Data Issues:** what to check or correct in the data. It has nine checks:
  - **people who may be one person:** a review queue of about 1,300 pairs of
    person ids, with the two careers side by side, scored by whether one
    career picks up where the other ends, the post and diocese at the
    handover, and the religious order
  - one person id listed under several surnames
  - institutions with years that have no place
  - records outside their diocese's territory
  - records whose county isn't the county the place lay in that year
  - circuits over 500 miles
  - institution ids with an unknown diocese prefix
  - **wording the markers miss:** notes that name a language, sisters,
    brothers or nuns, girls and boys, or fees, free schools and the poor in
    words the patterns don't read.
    The markers run over every record each time the server starts, so records
    added later are read the same way; this list shows the new wording to add.
  - **where they are today:** a review queue of institutions beside the
    Catholic churches, schools and hospitals on OpenStreetMap near them that
    share their dedication. The reviewer picks the one that is the institution
    today (its website comes with it), gives a link they found, or says none
    is.

  Each list downloads as a CSV. Review decisions are kept in the reviewer's
  browser and downloaded as a CSV. Added to `server/data/person-decisions.csv`
  or `server/data/institution-links.csv`, the decided items leave the queue
  for everyone, and confirmed links show on record pages.

  Data Issues is for the project's editors. It opens with a shared password
  (the lock at the top right of every page, or `/sign-in`), and signing in
  lasts 30 days in that browser. The server checks it too, so the data stays
  closed to everyone else, and the page and its links are hidden until then.

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
- **Rails, Rivers and Trails:** how near each year's institutions stood to
  the railroads in operation, the canals and steamboat rivers in use, and the
  overland trails and wagon roads in use that year (the Santa Fe, Oregon,
  California and Mormon trails, the caminos reales, the Butterfield mail and
  Pony Express routes), with the map coloured by distance to either a
  railroad or a trail, the shares near each over time, and distance bands.
- **Languages and Congregations:** where the almanacs marked a church,
  school or mission as German, French, Polish, Bohemian, Dutch, Italian,
  Spanish or Irish, or as serving Native American or Black Catholics. It has
  a map by year, a small chart for each category over time, a table of
  dioceses, and a CSV. Marks come from the almanac's language column, where
  English is the default, and from narrowly matched phrases in names and
  notes ("German Church", "Indian Mission", "for colored children").

- **Missions and Ceded Lands:** the Church set against Royce's Indian land
  cessions. For any year it shows land a Native nation still held and land
  ceded in the ten years before, how much of the Church stood on each, and
  every Native American mission with the nation, date and treaty of the land
  it stood on.
- **The Southwest:** the Church on land the United States took from Mexico
  (Texas, the land Texas claimed, the Mexican Cession), year by year, with
  three markers of its Hispanic Catholics: clergy with Spanish surnames,
  institutions with Spanish names, and congregations marked Spanish or
  Mexican. A diocese can be chosen; the page explains what a surname can and
  cannot tell.

**Change over time**

- **The Shape of the Church:** how the mix of institutions (parishes, schools,
  hospitals, charities) and of the people serving them, down to their titles,
  shifted across the years.
- **Comparing Places:** dioceses, states or years side by side.
- **Lifespans and Turnover:** institutions newly listed and no longer listed
  each year; how long new ones lasted (churches outlast schools and
  charities); and how often resident clergy left their posts, by year and by
  diocese. Each year is compared with the one before only where both have
  that diocese's records.
- **Who Ran It, Whom It Served:** the schools, academies, colleges, asylums,
  hospitals and religious houses by who the almanacs say ran them (a women's
  congregation, named where the almanac names it; men religious; diocesan
  clergy; lay teachers) and whether they took girls, boys or both: a map by
  year, both over time, the kinds of work, and every congregation's
  institutions year by year. The clergy lists name almost no women, so this
  page reads women through the institutions they ran.
- **Paying and Charity:** class without a census. The same works by whom
  they served by means: academies, colleges, boarding and select schools that
  took paying pupils; free schools; charities, by whom they took in (orphans,
  reform and industrial schools, Good Shepherd refuges, the aged, foundlings,
  servants, the poor); hospitals; and plain parish schools. Also what churches
  were built of (stone, brick, frame, log), and every fee and building cost
  the notes print, as examples.
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

- **County lines and very light county names** of that date from zoom 6.
  With no year chosen (a record's "All years"), the 1870 counties, railroads,
  canals and steamboat rivers are shown.
- **States, territories and the national border** of that date. Land outside
  the United States of the time is tinted, so the Mexican Cession or the
  Oregon Country read as foreign before they were annexed.
- **Railroads, canals and steamboat rivers** in operation that year. Railroads
  are drawn with the engraved cross-tie symbol of period maps, canals in blue,
  and steamboat rivers as dotted blue lines.
- **Indian land cessions** on maps that ask for them (Missions and Ceded
  Lands): land still held by a nation that year, and land ceded in the ten
  years before. Hovering shows each cession's nations, date and status; a click
  pins it with links to the treaty and Royce's schedule.
- **Diocese territories** show their name and the years that outline held when
  hovered.
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
- Several dashboards download what they show as CSV, each file starting with a
  comment line that gives the method, the filters and a citation:
  - Languages and Congregations: the year's marked institutions, and where
    each mark was found
  - Diocese by Diocese: records outside their diocese's territory
  - Data Issues: every check
- Duplicate-people decisions download as a CSV for
  `server/data/person-decisions.csv`.
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
- The overview, network, path, career, order, language and people-review data
  are built once per process from the database and answered from memory.
  Restart the API after a reseed.
- The tile build also writes two JSON files the API reads from the shared
  tiles volume: each record's distance to that year's railroads and
  waterways, and the diocese territory each record falls in.
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

The editors' password for the Data Issues page goes in a `.env` file beside
`docker-compose.yml`, which git ignores (copy `.env.example`). Without it the
page stays closed. Changing it signs everyone out; recreate the API container
to apply it (`docker compose up -d nodejs-prod`).

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
  polygons, street detail and the present-day places institutions are linked
  to (ODbL, © OpenStreetMap contributors), and
  [GeoNames](https://www.geonames.org/) towns (CC BY 4.0).
- **City populations:** U.S. Census Bureau, Campbell Gibson, *Population of
  the 100 Largest Cities and Other Urban Places in the United States: 1790 to
  1990* (Working Paper 27, 1998; public domain).
- **Terrain:** United States 3DEP, SRTM and GMTED2010 elevation data courtesy
  of the U.S. Geological Survey (public domain), as Mapzen's Terrain Tiles on
  AWS Open Data; the map shades the relief from them.
- **Historic trails:** the congressionally designated alignments of the
  national historic trails (Santa Fe, Oregon, California, Mormon Pioneer, Old
  Spanish, Pony Express, Trail of Tears, the caminos reales) and the
  Butterfield Overland Mail study route, from the National Park Service's
  National Trails office (works of the U.S. government, public domain), with
  the years each was in use from the NPS trail histories (`tiles/trails.csv`).
- **Historical boundaries:** *U.S. Historical States and Territories* and
  *U.S. Historical Counties*, Atlas of Historical County Boundaries, Dr. William M. Scholl Center for American
  History and Culture, The Newberry Library (CC BY-NC-SA 2.5).
- **Diocese territories:** drawn at Boston College for this project (in
  progress).
- **Indian land cessions:** *Tribal Lands Ceded to the United States*, U.S.
  Forest Service, Office of Tribal Relations
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), digitised from
  Charles C. Royce, *Indian Land Cessions in the United States* (Bureau of
  American Ethnology, 1899; public domain). For information only: it is not a
  source of title or legal boundaries, and it has not been reviewed by the
  National NAGPRA Program.
- **Spanish surnames:** *Frequently Occurring Surnames from the 2010 Census*,
  U.S. Census Bureau (a work of the federal government, public domain); the
  surnames that 75% or more of their bearers reported as Hispanic.
- **Historical streets:**
  [OpenHistoricalMap](https://www.openhistoricalmap.org/copyright) (CC0).
- **Railroads, canals and steamboat rivers:** Jeremy Atack's historical
  transportation GIS databases, Vanderbilt University
  ([downloads](https://my.vanderbilt.edu/jeremyatack/data-downloads/)).

Every map shows the credit and licence of each layer it draws in its (i)
credits. Full citations, dates and caveats for each map dataset are in
[`tiles/README.md`](tiles/README.md), and the maps credit them in their
attribution line.

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).
