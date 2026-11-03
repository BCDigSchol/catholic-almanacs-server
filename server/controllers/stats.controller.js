// Aggregate/summary endpoints powering the exploration dashboards.
// All counts are per-almanac-year snapshots: each institution appears at most
// once per year, so COUNT(DISTINCT instID) per year is "institutions recorded
// in the almanac for that year" — never a true census. The data is two islands
// of years (roughly 1833-1840 and 1860-1870) with a gap between, so absolute
// counts across the gap conflate real growth with the source's growing reach.
// Composition (share) metrics are far more robust to that and are the default.

const db = require("../models");
const { parseIntParam, networkCache, cacheKey } = require("../utils/network");
const { childIds, buildOverview } = require("../utils/overview");
const { buildCoverage } = require("../utils/coverage");
const dioceses = require("../utils/dioceses");
const { loadMoves, GAP_YEARS } = require("../utils/careers");

// The five canonical institution functions (from functions.csv). instFunction
// can be a compound string like "consecrated life institutions and educational
// institutions"; we bucket each institution-year by its PRIMARY (first) function
// so the buckets are mutually exclusive and shares sum to 100%.
const FUNCTION_BUCKETS = [
    'religious institutions',
    'educational institutions',
    'consecrated life institutions',
    'charitable institutions',
    'healthcare institutions'
];
const OTHER_BUCKET = 'other';

function primaryFunction(raw) {
    if (!raw) return OTHER_BUCKET;
    const first = String(raw).split(/\s+and\s+/i)[0].trim().toLowerCase();
    return FUNCTION_BUCKETS.includes(first) ? first : OTHER_BUCKET;
}

// Clergy hierarchy ranks, from the (heavily skewed) `title` field. Ordered
// high-to-low so the stacked chart reads as a pyramid from the top down.
const TITLE_BUCKETS = [
    'archbishop',          // Most Rev.
    'bishop',              // Rt. Rev. / Right Rev.
    'vicar or superior',   // Very Rev.
    'priest',              // Rev. (and Rev. Father / Fr. / P.)
    'seminarian or lay'    // Rev. Mr. / Mr.
];

// Buckets a title string into a rank. Order matters: more specific prefixes
// (which all contain "Rev") are tested before the bare "Rev." priest catch-all.
function titleRank(raw) {
    if (!raw) return OTHER_BUCKET;
    const t = String(raw).toLowerCase();
    if (t.includes('most rev')) return 'archbishop';
    if (t.includes('rt. rev') || t.includes('rt rev') || t.includes('right rev')) return 'bishop';
    if (t.includes('very rev')) return 'vicar or superior';
    if (/\bmr\b/.test(t)) return 'seminarian or lay';   // "Rev. Mr." or "Mr."
    if (t.includes('rev')) return 'priest';
    return OTHER_BUCKET;
}

// Builds the shared almanacRecord WHERE clause (function present + optional
// diocese/state/year), with each column prefixed for the active table alias.
function buildCompositionWhere(prefix, { diocese, state, startYear, endYear }, requireFunction = true) {
    const where = requireFunction ? [`${prefix}instFunction IS NOT NULL`, `${prefix}instFunction <> ''`] : [];
    const replacements = {};
    if (diocese) { where.push(`${prefix}diocese_reg = :diocese`); replacements.diocese = diocese; }
    if (state) { where.push(`${prefix}stateOrig = :state`); replacements.state = state; }
    if (startYear != null) { where.push(`${prefix}year >= :startYear`); replacements.startYear = startYear; }
    if (endYear != null) { where.push(`${prefix}year <= :endYear`); replacements.endYear = endYear; }
    return { whereStr: where.length ? where.join(' AND ') : '1=1', replacements };
}

// Returns the composition by institution function for each almanac year, for
// either institutions (entity=institutions, the default) or the people who
// served them (entity=people). Optionally scoped to one diocese and/or state.
// Response is tidy long-format rows the client feeds straight into a chart.
exports.getComposition = async (req, res) => {
    const { diocese, state } = req.query;
    const entity = req.query.entity === 'people' ? 'people' : 'institutions';
    const dimension = req.query.dimension === 'title' ? 'title' : 'function';
    if (dimension === 'title' && entity !== 'people') {
        return res.status(400).json({ message: "dimension 'title' is only available for entity 'people'." });
    }

    const startParam = parseIntParam(req.query.startYear, 'startYear');
    if (startParam.error) return res.status(400).json({ message: startParam.error });
    const endParam = parseIntParam(req.query.endYear, 'endYear');
    if (endParam.error) return res.status(400).json({ message: endParam.error });
    const startYear = startParam.value;
    const endYear = endParam.value;
    if (startYear != null && endYear != null && startYear > endYear) {
        return res.status(400).json({ message: `startYear (${startYear}) must not be greater than endYear (${endYear}).` });
    }

    const key = cacheKey('stats/composition', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    const filters = { diocese, state, startYear, endYear };
    const isTitle = dimension === 'title';
    const bucketer = isTitle ? titleRank : primaryFunction;
    const ALL_BUCKETS = isTitle ? TITLE_BUCKETS : FUNCTION_BUCKETS;

    try {
        // Every branch returns rows of { year, bucketRaw, count }; the folding
        // and response below are identical from there.
        let rows;
        if (entity === 'people') {
            // People have no native geography/function/rank — they inherit it from
            // the institution-year they served. A person at several institutions in
            // one year is counted ONCE, attributed to a single representative record
            // (the lowest matching almanacRecordID), so the stack stays a clean 100%.
            // Function comes from that record's institution; rank from its person row.
            const { whereStr, replacements } = buildCompositionWhere('ar.', filters, !isTitle);
            const innerPri =
                `SELECT piar.persID AS persID, ar.year AS year, MIN(piar.almanacRecordID) AS repID
                 FROM personInAlmanacRecords piar
                 JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID
                 WHERE ${whereStr}
                 GROUP BY piar.persID, ar.year`;
            const sql = isTitle
                ? `SELECT pri.year AS year, rep.title AS bucketRaw, COUNT(*) AS count
                   FROM (${innerPri}) pri
                   JOIN personInAlmanacRecords rep ON rep.persID = pri.persID AND rep.almanacRecordID = pri.repID
                   GROUP BY pri.year, rep.title
                   ORDER BY pri.year`
                : `SELECT pri.year AS year, rep.instFunction AS bucketRaw, COUNT(*) AS count
                   FROM (${innerPri}) pri
                   JOIN almanacRecords rep ON rep.ID = pri.repID
                   GROUP BY pri.year, rep.instFunction
                   ORDER BY pri.year`;
            rows = await db.sequelize.query(sql, { replacements, type: db.Sequelize.QueryTypes.SELECT });
        } else {
            // One row per (year, raw instFunction). Each institution-year has
            // exactly one instFunction string, so summing by primary bucket is exact.
            const { whereStr, replacements } = buildCompositionWhere('', filters);
            rows = await db.sequelize.query(
                `SELECT year, instFunction AS bucketRaw, COUNT(DISTINCT instID) AS count
                 FROM almanacRecords
                 WHERE ${whereStr}
                 GROUP BY year, instFunction
                 ORDER BY year`,
                { replacements, type: db.Sequelize.QueryTypes.SELECT }
            );
        }

        // Fold raw values into canonical buckets, keyed by year
        const byYear = new Map(); // year -> { bucket -> count }
        for (const row of rows) {
            const bucket = bucketer(row.bucketRaw);
            if (!byYear.has(row.year)) byYear.set(row.year, {});
            const buckets = byYear.get(row.year);
            buckets[bucket] = (buckets[bucket] || 0) + Number(row.count);
        }

        const years = Array.from(byYear.keys()).sort((a, b) => a - b);
        const usedBuckets = [...ALL_BUCKETS, OTHER_BUCKET]
            .filter(b => years.some(y => byYear.get(y)[b]));

        const tidy = [];
        for (const year of years) {
            const buckets = byYear.get(year);
            const total = Object.values(buckets).reduce((a, b) => a + b, 0);
            for (const group of usedBuckets) {
                const count = buckets[group] || 0;
                tidy.push({
                    year,
                    group,
                    count,
                    total,
                    share: total > 0 ? count / total : 0
                });
            }
        }

        const baseNote = 'Years not shown were not published or collected; across long gaps, absolute counts reflect the source\'s growing coverage rather than only real growth, so share is the more comparable measure.';
        let note;
        if (isTitle) {
            note = 'Counts are people as recorded in the almanac each year, grouped by the rank implied by their title. Most clergy are listed simply as "Rev.", so the lay/seminarian and higher ranks are small by comparison. Someone listed several times in a year is counted once, by a representative record. ' + baseNote;
        } else if (entity === 'people') {
            note = 'Counts are people as recorded in the almanac each year, grouped by the function of the institution they served. Someone serving several institutions in a year is counted once, by a representative affiliation. ' + baseNote;
        } else {
            note = 'Counts are institutions as recorded in the almanac for each year. ' + baseNote;
        }

        const result = {
            meta: {
                entity,
                dimension,
                diocese: diocese || null,
                state: state || null,
                buckets: usedBuckets,
                years,
                note
            },
            rows: tidy
        };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Compares a SUBSET of institutions against the WHOLE, year by year, so a
// researcher can ask "all Catholic hospitals grew X%, but did this subset
// grow faster?" The "whole" is every institution matching a category (a type
// like 'hospital' or a function like 'healthcare institutions'); the "subset"
// is that same set narrowed by one dimension (religious order, diocese, or
// state). Both are returned as raw per-year counts; the client indexes them.
const SUBSET_KINDS = {
    order: { join: 'JOIN orderInAlmanacRecords oiar ON oiar.almanacRecordID = ar.ID', clause: 'oiar.`order` = :subsetValue' },
    diocese: { join: '', clause: 'ar.diocese_reg = :subsetValue' },
    state: { join: '', clause: 'ar.stateOrig = :subsetValue' }
};

exports.getSubsetVsWhole = async (req, res) => {
    const { categoryKind, category, subsetKind, subsetValue } = req.query;

    if (categoryKind !== 'type' && categoryKind !== 'function') {
        return res.status(400).json({ message: "categoryKind must be 'type' or 'function'." });
    }
    if (!category) {
        return res.status(400).json({ message: 'category is required.' });
    }
    if (!SUBSET_KINDS[subsetKind]) {
        return res.status(400).json({ message: "subsetKind must be 'order', 'diocese', or 'state'." });
    }
    if (!subsetValue) {
        return res.status(400).json({ message: 'subsetValue is required.' });
    }
    const entity = req.query.entity === 'people' ? 'people' : 'institutions';

    const key = cacheKey('stats/subset-vs-whole', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    // Category is matched with LIKE so compound entries count too — e.g. an
    // instType of "hospital, asylum" is included when category is "hospital".
    const categoryColumn = categoryKind === 'type' ? 'ar.instType' : 'ar.instFunction';
    const categoryClause = `${categoryColumn} LIKE :category`;
    const replacements = { category: `%${category}%`, subsetValue };
    const subset = SUBSET_KINDS[subsetKind];

    // For people we count distinct persons serving institutions of the category,
    // by joining the person records to those institution-years. For institutions
    // we count the institutions themselves.
    const countExpr = entity === 'people' ? 'COUNT(DISTINCT piar.persID)' : 'COUNT(DISTINCT ar.instID)';
    const baseFrom = entity === 'people'
        ? 'personInAlmanacRecords piar JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID'
        : 'almanacRecords ar';

    try {
        const wholeRows = await db.sequelize.query(
            `SELECT ar.year AS year, ${countExpr} AS count
             FROM ${baseFrom}
             WHERE ${categoryClause}
             GROUP BY ar.year
             ORDER BY ar.year`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        const subsetRows = await db.sequelize.query(
            `SELECT ar.year AS year, ${countExpr} AS count
             FROM ${baseFrom}
             ${subset.join}
             WHERE ${categoryClause} AND ${subset.clause}
             GROUP BY ar.year
             ORDER BY ar.year`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        const noun = entity === 'people' ? 'people serving institutions' : 'institutions';
        const toSeries = rows => rows.map(r => ({ year: r.year, count: Number(r.count) }));
        const result = {
            meta: {
                entity,
                categoryKind,
                category,
                subsetKind,
                subsetValue,
                years: wholeRows.map(r => r.year),
                note: `Counts are ${noun} recorded in the almanac each year. Religious-order tagging currently covers a small share of institutions and a limited range of years, so order subsets rest on small numbers — read indexed growth alongside the raw counts.`
            },
            whole: toSeries(wholeRows),
            subset: toSeries(subsetRows)
        };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Geo points for the "Spread of the Church" map dashboard. Returns every
// almanac-year location aggregated to a ~0.1 degree grid (so the payload stays
// small and the heatmap weights are meaningful), tagged with its primary
// function, plus a per-year timeline of total count and the geographic
// centre-of-gravity (mean lng/lat). The client animates a single year at a time
// and reads the centroid marching west as the headline "spread" signal.
//
// entity=institutions (default): weight = institution-years at that cell.
// entity=people: weight = people-years serving institutions at that cell.
//
// by=function (default): each point is tagged with its primary function (`fn`).
// by=diocese: each point is tagged with its registered diocese (`diocese`), and
//   meta.categories lists every diocese with its total weight (biggest first) so
//   the "Diocese by Diocese" tracker can build a selector + legend.
exports.getGeo = async (req, res) => {
    const entity = req.query.entity === 'people' ? 'people' : 'institutions';
    const by = req.query.by === 'diocese' ? 'diocese' : 'function';
    const catField = by === 'diocese' ? 'diocese' : 'fn';
    // detail=1 returns one point PER institution (with its instID) instead of
    // grid-aggregated cells, so a discrete-points map can link to each church.
    const detail = req.query.detail === '1' && entity === 'institutions';

    const key = cacheKey('stats/geo', { entity, by, detail });
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    try {
        let rows;
        if (entity === 'people') {
            rows = await db.sequelize.query(
                `SELECT ar.instID AS instID, ar.latitude AS lat, ar.longitude AS lng, ar.year AS year,
                        ar.instFunction AS fn, ar.diocese_reg AS diocese, COUNT(piar.persID) AS weight
                 FROM personInAlmanacRecords piar
                 JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID
                 WHERE ar.latitude IS NOT NULL AND ar.longitude IS NOT NULL AND ar.year IS NOT NULL
                 GROUP BY ar.ID, ar.instID, ar.latitude, ar.longitude, ar.year, ar.instFunction, ar.diocese_reg`,
                { type: db.Sequelize.QueryTypes.SELECT }
            );
        } else {
            rows = await db.sequelize.query(
                `SELECT instID AS instID, latitude AS lat, longitude AS lng, year AS year,
                        instFunction AS fn, diocese_reg AS diocese, 1 AS weight
                 FROM almanacRecords
                 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND year IS NOT NULL`,
                { type: db.Sequelize.QueryTypes.SELECT }
            );
        }

        // Category for each row: a function bucket, or the diocese keyed by its
        // CANONICAL id (instID prefix), so name variants merge onto one category.
        const categoryOf = r => by === 'diocese'
            ? (dioceses.resolveDioceseId(r.instID, r.diocese) || 'unknown')
            : primaryFunction(r.fn);

        const round3 = n => Math.round(n * 1000) / 1000;
        const pointMap = new Map();    // "year|lat|lng|cat" -> summed weight
        const detailPoints = [];       // un-aggregated, one per institution-year
        const yearStats = new Map();   // year -> { total, sumLng, sumLat }
        const catTotals = new Map();   // category -> total weight (all years)
        for (const r of rows) {
            const w = Number(r.weight) || 0;
            if (!w) continue;
            const lat = Number(r.lat);
            const lng = Number(r.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            // Skip impossible coordinates (e.g. a lost decimal turning 44.47 into
            // 4447967) — a single one would otherwise poison the weighted centroid
            // and fling the "centre of gravity" marker millions of miles off.
            if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
            const cat = categoryOf(r);
            catTotals.set(cat, (catTotals.get(cat) || 0) + w);
            // Centroid is the WEIGHTED mean of exact locations (a place with many
            // institutions/people pulls it proportionally — not an extremes average).
            let ys = yearStats.get(r.year);
            if (!ys) { ys = { total: 0, sumLng: 0, sumLat: 0 }; yearStats.set(r.year, ys); }
            ys.total += w;
            ys.sumLng += lng * w;
            ys.sumLat += lat * w;

            if (detail) {
                detailPoints.push({ year: r.year, lat: round3(lat), lng: round3(lng), [catField]: cat, i: r.instID, weight: w });
            } else {
                const rlat = Math.round(lat * 10) / 10;
                const rlng = Math.round(lng * 10) / 10;
                const pkey = `${r.year}|${rlat}|${rlng}|${cat}`;
                pointMap.set(pkey, (pointMap.get(pkey) || 0) + w);
            }
        }

        let points;
        if (detail) {
            points = detailPoints;
        } else {
            points = [];
            for (const [pkey, weight] of pointMap) {
                // Split off the trailing category (diocese names contain no '|').
                const idx = pkey.indexOf('|');
                const idx2 = pkey.indexOf('|', idx + 1);
                const idx3 = pkey.indexOf('|', idx2 + 1);
                const year = Number(pkey.slice(0, idx));
                const lat = Number(pkey.slice(idx + 1, idx2));
                const lng = Number(pkey.slice(idx2 + 1, idx3));
                const cat = pkey.slice(idx3 + 1);
                points.push({ year, lat, lng, [catField]: cat, weight });
            }
        }
        const years = Array.from(yearStats.entries())
            .map(([year, s]) => ({
                year,
                total: s.total,
                centroidLng: s.sumLng / s.total,
                centroidLat: s.sumLat / s.total
            }))
            .sort((a, b) => a.year - b.year);

        // Diocese categories carry a display name (canonical id -> latest name);
        // function categories are their own label.
        const dioNames = by === 'diocese' ? dioceseNameMap() : null;
        const categories = Array.from(catTotals.entries())
            .map(([key, total]) => dioNames ? { key, total, name: dioNames[key] || key } : { key, total })
            .sort((a, b) => b.total - a.total);

        const result = {
            meta: {
                entity,
                by,
                categories,
                note: `Each point is an almanac-year location snapped to a ~0.1° grid; weight is the number of ${entity === 'people' ? 'people-years serving institutions' : 'institution-years'} there.`
            },
            years,
            points
        };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// ---- Overview dashboard ("god view"): server-side cross-filtering ----
//
// The browser holds NO data. It posts the current filter state to /overview and
// gets back only the panel results. We aggregate in-memory over a fact array
// built once per process (the corpus is static), so each request is cheap and
// the payload is a few KB instead of the whole ~700 KB corpus.

const OVERVIEW_NOTE = 'Counts are distinct institutions (or distinct people), deduplicated across years.';

// Canonical diocese id -> display name, for panels that key dioceses by id.
let _dioceseNames = null;
function dioceseNameMap() {
    if (_dioceseNames) return _dioceseNames;
    _dioceseNames = { unknown: 'Unknown' };
    for (const [id, m] of dioceses.load().byId) _dioceseNames[id] = m.displayName;
    return _dioceseNames;
}

// Internal fact array, built once. Each fact:
//   { i,y,f,t,d,s,lat,lng, pp:[personIds], o:[orders], _c:[childInstitutionIds] }
let _factsPromise = null;
let _factYears = [];

function loadFacts() {
    if (!_factsPromise) _factsPromise = buildFactArray();
    return _factsPromise;
}

// The year each institution was first listed, by child id (branching ids
// like "a&b" split), from the facts; built once.
let _firstListed = null;
function firstListed(facts) {
    if (_firstListed) return _firstListed;
    const byId = new Map();
    const years = new Set();
    for (const f of facts) {
        years.add(f.y);
        for (const id of String(f.i).split(/[&=]/)) {
            if (!byId.has(id) || f.y < byId.get(id)) byId.set(id, f.y);
        }
    }
    const of = inst => Math.min(...String(inst).split(/[&=]/).map(id => byId.get(id) ?? Infinity));
    // "new" in a year: first listed that year, and only where the year before
    // is in the data (not the first almanac year, nor 1864 after the
    // untranscribed 1839-63, when nearly every institution is "first listed")
    const isNew = (inst, year) => years.has(year - 1) && of(inst) === year;
    _firstListed = { of, isNew, byId };
    return _firstListed;
}

async function buildFactArray() {
    // GROUP BY ar.ID (the PK) lets MySQL treat the other ar.* columns as
    // functionally dependent. orders fan-out is collapsed by GROUP_CONCAT.
    const rows = await db.sequelize.query(
        `SELECT ar.ID AS recID, ar.instID AS instID, ar.year AS year,
                ar.instFunction AS fn, ar.instType AS type,
                ar.diocese_reg AS diocese, ar.stateOrig AS state,
                ar.latitude AS lat, ar.longitude AS lng,
                GROUP_CONCAT(DISTINCT oiar.\`order\`) AS orders
         FROM almanacRecords ar
         LEFT JOIN orderInAlmanacRecords oiar ON oiar.almanacRecordID = ar.ID
         WHERE ar.year IS NOT NULL
         GROUP BY ar.ID`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );

    // Person ids per record (separate query, not GROUP_CONCAT, to avoid
    // truncation on big institutions). recID -> [persID, ...].
    const personRows = await db.sequelize.query(
        `SELECT piar.almanacRecordID AS recID, piar.persID AS persID
         FROM personInAlmanacRecords piar
         JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID
         WHERE ar.year IS NOT NULL AND piar.persID IS NOT NULL
         GROUP BY piar.almanacRecordID, piar.persID`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    const personsByRec = new Map();
    for (const pr of personRows) {
        let arr = personsByRec.get(pr.recID);
        if (!arr) { arr = []; personsByRec.set(pr.recID, arr); }
        arr.push(pr.persID);
    }

    const clean = v => (v && String(v).trim() ? String(v).trim() : null);
    const round = n => {
        const x = Number(n);
        return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null;
    };

    const facts = rows.map(r => {
        const i = r.instID;
        const d = clean(r.diocese) || 'Unknown';
        return {
            rec: r.recID,   // the almanac record (one institution in one year)
            i,
            y: Number(r.year),
            f: primaryFunction(r.fn),
            t: clean(r.type),
            d,
            s: clean(r.state),
            lat: round(r.lat),
            lng: round(r.lng),
            pp: personsByRec.get(r.recID) || [],
            o: r.orders ? String(r.orders).split(',').map(s => s.trim()).filter(Boolean) : [],
            _c: childIds(i),
            _dio: dioceses.resolveDioceseId(i, d) || 'unknown'   // canonical diocese id
        };
    });
    _factYears = Array.from(new Set(facts.map(f => f.y))).sort((a, b) => a - b);
    return facts;
}

// POST /api/stats/overview  body: { entity, years[], functions[], types[], dioceses[] }
// Returns { kpis, functions, types, dioceses, years, map, meta } — just the panels.
exports.getOverview = async (req, res) => {
    const body = req.body || {};
    const entity = body.entity === 'people' ? 'people' : 'institutions';
    const arr = v => (Array.isArray(v) ? v : []);
    const yearsArr = arr(body.years).map(Number).filter(Number.isFinite);
    const fnArr = arr(body.functions).map(String);
    const typeArr = arr(body.types).map(String);
    const dioArr = arr(body.dioceses).map(String);

    // Stable cache key (data is static, so identical filter states are free).
    const j = a => a.slice().sort().join(',');
    const key = `stats/overview?e=${entity}&y=${j(yearsArr.map(String))}&f=${j(fnArr)}&t=${j(typeArr)}&d=${j(dioArr)}`;
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    try {
        const facts = await loadFacts();
        const state = {
            years: new Set(yearsArr),
            functions: new Set(fnArr),
            types: new Set(typeArr),
            dioceses: new Set(dioArr)
        };
        const result = buildOverview(facts, state, entity, _factYears, [...FUNCTION_BUCKETS, OTHER_BUCKET]);
        result.meta = { entity, years: _factYears, note: OVERVIEW_NOTE, dioceseNames: dioceseNameMap() };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// GET /api/stats/coverage — "shape of the data": diocese x year matrix plus a
// spatial 0.5deg binned heatmap. Aggregated over the same cached fact array.
exports.getCoverage = async (req, res) => {
    const key = cacheKey('stats/coverage', {});
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    try {
        const facts = await loadFacts();
        const result = buildCoverage(facts, _factYears);
        result.note = 'Coverage = distinct institutions recorded for a diocese in a year. It reflects how thoroughly the almanacs documented each see over time, not the true size of the church. Hatched cells are years a diocese did not yet exist; light cells are years it existed but has no records encoded yet.';
        // One-time data-quality report (cached response means this logs once).
        if (result.report) {
            const { seededEmptyDioceses, unmatchedPrefixes } = result.report;
            console.log(`[coverage] diocese timeline: ${seededEmptyDioceses} existing sees seeded with no data`
                + (unmatchedPrefixes.length ? `; ${unmatchedPrefixes.length} instID prefixes not in CSV: ${unmatchedPrefixes.join(', ')}` : '; all instID prefixes matched the CSV'));
        }
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// GET /api/stats/circuits — every circuit link of every year, for the national
// Circuits dashboard: a station (a church or mission without a resident
// priest) served from a hub (the institution its priest came from). Two
// sources, merged: the attending table, and priests listed at a place as
// visiting from another institution.
//   years   [{year, institutions, stations, hubs, links, byDiocese}]  (distinct
//           counts; byDiocese = institutions per diocese id, for shares)
//   places  {instID: [name, type, town, dioceseId]}  (latest year's details)
//   links   [[year, hub, station, hubLat, hubLng, stLat, stLng, via]]
//           via: 1 = attending table, 2 = visiting priest, 3 = both
//   dioceseNames  {id: display name} for the hubs' dioceses
//   misplaced  links left out as longer than MAX_CIRCUIT_MILES: one end's
//           coordinates are wrong (e.g. Viota, WI geocoded to Colombia), not a
//           real ride; [[year, hub, station, miles]], for cleaning the data
const MAX_CIRCUIT_MILES = 500;
const milesBetween = (lat1, lng1, lat2, lng2) => {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2
        + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2;
    return 3959 * 2 * Math.asin(Math.sqrt(a));
};

exports.getCircuits = async (req, res) => {
    res.send(await circuitsData());
};

/** The circuits response, built once and cached (also read by the data-issues check). */
async function circuitsData() {
    const key = cacheKey('stats/circuits', {});
    const cached = networkCache.get(key);
    if (cached) return cached;

    const q = (sql) => db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT });
    const [table, visits, records] = await Promise.all([
        q(`SELECT me.year, me.instID AS hub, me.latitude AS hlat, me.longitude AS hlng,
                  st.instID AS st, st.latitude AS slat, st.longitude AS slng
             FROM attendingInstitutions a
             JOIN almanacRecords me ON me.ID = a.attendingInstRecordID
             JOIN almanacRecords st ON st.ID = a.attendedInstRecordID`),
        q(`SELECT ar.year, home.instID AS hub, home.latitude AS hlat, home.longitude AS hlng,
                  ar.instID AS st, ar.latitude AS slat, ar.longitude AS slng
             FROM personInAlmanacRecords pia
             JOIN almanacRecords ar ON ar.ID = pia.almanacRecordID
             JOIN almanacRecords home ON home.instID = pia.attendingInstID AND home.year = ar.year
            WHERE pia.isAttending = 1`),
        q(`SELECT instID, year, instName, instType, cityReg, placeName, diocese FROM almanacRecords`),
    ]);

    const round = v => Math.round(v * 1e4) / 1e4;
    const links = new Map();
    const misplaced = new Map();
    const add = (rows, bit) => {
        for (const r of rows) {
            if (!r.hlat || !r.hlng || !r.slat || !r.slng || r.hub === r.st) continue;
            const k = `${r.year}|${r.hub}|${r.st}`;
            const miles = milesBetween(r.hlat, r.hlng, r.slat, r.slng);
            if (miles > MAX_CIRCUIT_MILES) {
                misplaced.set(k, [r.year, r.hub, r.st, Math.round(miles)]);
                continue;
            }
            const l = links.get(k);
            if (l) { l[7] |= bit; continue; }
            links.set(k, [r.year, r.hub, r.st, round(r.hlat), round(r.hlng), round(r.slat), round(r.slng), bit]);
        }
    };
    add(table, 1);
    add(visits, 2);

    const involved = new Set();
    for (const l of links.values()) { involved.add(l[1]); involved.add(l[2]); }
    const latest = new Map();
    const perYear = new Map();
    const perYearDio = new Map();
    for (const r of records) {
        let s = perYear.get(r.year);
        if (!s) perYear.set(r.year, s = new Set());
        if (!s.has(r.instID)) {
            s.add(r.instID);
            const dio = dioceses.resolveDioceseId(r.instID, r.diocese) || 'unknown';
            let d = perYearDio.get(r.year);
            if (!d) perYearDio.set(r.year, d = {});
            d[dio] = (d[dio] || 0) + 1;
        }
        if (involved.has(r.instID) && (!latest.has(r.instID) || r.year >= latest.get(r.instID).year)) latest.set(r.instID, r);
    }
    const places = {};
    const dioceseNames = {};
    const names = dioceseNameMap();
    for (const [id, r] of latest) {
        const dio = dioceses.resolveDioceseId(id, r.diocese) || 'unknown';
        places[id] = [r.instName || '', r.instType || '', r.cityReg || r.placeName || '', dio];
        dioceseNames[dio] = names[dio] || r.diocese || dio;
    }

    const byYear = new Map();
    for (const l of links.values()) {
        let y = byYear.get(l[0]);
        if (!y) byYear.set(l[0], y = { hubs: new Set(), stations: new Set(), links: 0 });
        y.hubs.add(l[1]); y.stations.add(l[2]); y.links++;
    }
    const years = [...perYear.keys()].sort((a, b) => a - b).map(year => {
        const y = byYear.get(year);
        return { year, institutions: perYear.get(year).size, stations: y ? y.stations.size : 0, hubs: y ? y.hubs.size : 0,
            links: y ? y.links : 0, byDiocese: perYearDio.get(year) };
    });

    const result = {
        years,
        places,
        links: [...links.values()].sort((a, b) => a[0] - b[0]),
        dioceseNames,
        misplaced: [...misplaced.values()],
        note: 'A circuit link is a station recorded as attended from another institution, or a priest listed at a place as visiting from his own. The almanacs of the 1830s printed few such links; from 1864 they list most stations, so much of the rise reflects fuller reporting.',
    };
    networkCache.set(key, result);
    return result;
}

// GET /api/stats/railroads?diocese=&fn=&year= — how near the institutions of
// each year stood to the railroads, and to the canals and steamboat rivers, in
// use that year. The distances are measured by the tile build
// (tiles/transport-distances.py) into the shared tiles volume; without that
// file this answers 404 and the dashboard says the data isn't built.
//   years   [{year, n, nearRail, nearWater, nearEither, nearTrail, medianRail, bands, trailBands}]
//           near = within NEAR_MILES; bands = counts by distance to a railroad
//           (trailBands: to a historic trail, from tiles-build trails' trail-distances.json)
//   points  for ?year=: [[lat, lng, railMiles|null, instID, trailMiles|null, isNew 0|1]]
//           (isNew: first listed that year)
//   meta.trails  whether the trail distances are built here
//   dioceses  {id: name} with any measured institution, for the filter
const NEAR_MILES = 5;
const RAIL_BANDS = [1, 5, 15, 50];   // ≤1, ≤5, ≤15, ≤50, farther or none
let _transport = null;
// each record's distance to the historic trails of its year (tiles-build
// trails); optional: without it the trail figures are left out
let _trails = null;
function loadTrailDistances() {
    if (_trails) return _trails;
    const file = process.env.TRAIL_DISTANCES || '/tiles-data/trail-distances.json';
    try {
        _trails = JSON.parse(require('fs').readFileSync(file, 'utf8')).records;
    } catch {
        return null;
    }
    return _trails;
}

function loadTransportDistances() {
    if (_transport) return _transport;
    const file = process.env.TRANSPORT_DISTANCES || '/tiles-data/transport-distances.json';
    try {
        _transport = JSON.parse(require('fs').readFileSync(file, 'utf8')).records;
    } catch {
        return null;   // not built here: try again next time
    }
    return _transport;
}

exports.getRailroads = async (req, res) => {
    const distances = loadTransportDistances();
    if (!distances) {
        return res.status(404).json({ message: 'The railroad distances are not built on this server (tiles-build transport).' });
    }
    const diocese = typeof req.query.diocese === 'string' ? req.query.diocese : '';
    const fn = typeof req.query.fn === 'string' ? req.query.fn : '';
    const yearParam = parseIntParam(req.query.year, 'year');
    if (yearParam.error) return res.status(400).json({ message: yearParam.error });
    const year = yearParam.value;

    const key = cacheKey('stats/railroads', { diocese, fn, year });
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    const facts = await loadFacts();
    const trails = loadTrailDistances();
    const names = dioceseNameMap();
    const dioceseNames = {};
    const byYear = new Map();
    const points = [];
    const listed = firstListed(facts);
    for (const f of facts) {
        const d = distances[f.rec];
        if (!d) continue;
        const trail = trails ? trails[f.rec] ?? null : null;
        dioceseNames[f._dio] = names[f._dio] || f.d;
        if (diocese && f._dio !== diocese) continue;
        if (fn && f.f !== fn) continue;
        let y = byYear.get(f.y);
        if (!y) byYear.set(f.y, y = { year: f.y, n: 0, nearRail: 0, nearWater: 0, nearEither: 0, nearTrail: 0, rail: [], bands: [0, 0, 0, 0, 0], trailBands: [0, 0, 0, 0, 0] });
        const [rail, water] = d;
        const nr = rail != null && rail <= NEAR_MILES, nw = water != null && water <= NEAR_MILES;
        y.n++;
        if (nr) y.nearRail++;
        if (nw) y.nearWater++;
        if (nr || nw) y.nearEither++;
        if (trail != null && trail <= NEAR_MILES) y.nearTrail++;
        const tband = trail == null ? RAIL_BANDS.length : RAIL_BANDS.findIndex(b => trail <= b);
        y.trailBands[tband === -1 ? RAIL_BANDS.length : tband]++;
        if (rail != null) y.rail.push(rail);
        const band = rail == null ? RAIL_BANDS.length : RAIL_BANDS.findIndex(b => rail <= b);
        y.bands[band === -1 ? RAIL_BANDS.length : band]++;
        if (year && f.y === year && f.lat != null && f.lng != null) points.push([f.lat, f.lng, rail, f.i, trail, listed.isNew(f.i, f.y) ? 1 : 0]);
    }
    const years = [...byYear.values()].sort((a, b) => a.year - b.year).map(y => {
        const sorted = y.rail.sort((a, b) => a - b);
        const medianRail = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
        const { rail, ...rest } = y;
        return { ...rest, medianRail };
    });
    const result = {
        years,
        points,
        dioceses: dioceseNames,
        meta: { nearMiles: NEAR_MILES, bands: RAIL_BANDS, trails: !!trails },
    };
    networkCache.set(key, result);
    res.send(result);
};

// GET /api/stats/clergy-flows?from=&to=&gap=include — clergy moving between
// dioceses (utils/careers.js), for the Clergy Flows dashboard. A move counts
// in the years it arrived (from/to); moves across the almanacs' 1838–1864 gap
// are left out unless gap=include.
//   dioceses  [{id, name, lat, lng, out, in, within}]  (lat/lng: the see's
//             cathedral, else the centre of its institutions)
//   flows     [{from, to, people, names, years}]  between different dioceses
//   totals    {moves, people, cross, gapMoves}
let _seeAt = null;
// A point in the lower 48 (a few records carry swapped or zeroed coordinates).
const inUS = (lat, lng) => lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66;
async function seeLocations() {
    if (_seeAt) return _seeAt;
    const at = new Map();
    const cathedrals = await db.sequelize.query(
        `SELECT instID, diocese, year, latitude, longitude FROM almanacRecords
          WHERE instType = 'cathedral' AND latitude IS NOT NULL ORDER BY year`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    for (const c of cathedrals) {
        if (inUS(c.latitude, c.longitude)) at.set(dioceses.resolveDioceseId(c.instID, c.diocese) || 'unknown', [c.latitude, c.longitude]);
    }
    // no cathedral recorded: the median of the diocese's institutions (robust to stray points)
    const pts = new Map();
    for (const f of await loadFacts()) {
        if (f.lat == null || f.lng == null || at.has(f._dio) || !inUS(f.lat, f.lng)) continue;
        const p = pts.get(f._dio) || [[], []];
        p[0].push(f.lat); p[1].push(f.lng);
        pts.set(f._dio, p);
    }
    const median = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    for (const [id, [lats, lngs]] of pts) at.set(id, [median(lats), median(lngs)]);
    _seeAt = at;
    return at;
}

exports.getClergyFlows = async (req, res) => {
    const from = parseIntParam(req.query.from, 'from');
    const to = parseIntParam(req.query.to, 'to');
    if (from.error || to.error) return res.status(400).json({ message: from.error || to.error });
    const withGap = req.query.gap === 'include';
    const key = cacheKey('stats/clergy-flows', { from: from.value, to: to.value, gap: withGap });
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    const [moves, seeAt] = await Promise.all([loadMoves(), seeLocations()]);
    const names = dioceseNameMap();
    const stats = new Map();
    const stat = id => {
        let s = stats.get(id);
        if (!s) stats.set(id, s = { id, name: names[id] || id, out: new Set(), in: new Set(), within: new Set() });
        return s;
    };
    const flows = new Map();
    const people = new Set();
    let count = 0, gapMoves = 0;
    for (const m of moves) {
        if ((from.value != null && m.y2 < from.value) || (to.value != null && m.y2 > to.value)) continue;
        if (m.gap) { gapMoves++; if (!withGap) continue; }
        if (m.from.dio === 'unknown' || m.to.dio === 'unknown') continue;
        count++;
        people.add(m.pers);
        if (m.from.dio === m.to.dio) { stat(m.from.dio).within.add(m.pers); continue; }
        stat(m.from.dio).out.add(m.pers);
        stat(m.to.dio).in.add(m.pers);
        const k = `${m.from.dio}|${m.to.dio}`;
        let f = flows.get(k);
        if (!f) flows.set(k, f = { from: m.from.dio, to: m.to.dio, people: new Map(), years: new Set() });
        f.people.set(m.pers, m.name);
        f.years.add(m.y2);
    }
    const result = {
        dioceses: [...stats.values()].map(s => {
            const at = seeAt.get(s.id);
            return { id: s.id, name: s.name, lat: at ? at[0] : null, lng: at ? at[1] : null,
                out: s.out.size, in: s.in.size, within: s.within.size };
        }),
        flows: [...flows.values()]
            .map(f => ({ from: f.from, to: f.to, people: f.people.size, names: [...f.people.values()].slice(0, 6),
                years: [...f.years].sort((a, b) => a - b) }))
            .sort((a, b) => b.people - a.people),
        totals: { moves: count, people: people.size, cross: [...flows.values()].reduce((n, f) => n + f.people.size, 0), gapMoves },
        meta: { gapYears: GAP_YEARS, includesGap: withGap },
    };
    networkCache.set(key, result);
    res.send(result);
};

// GET /api/stats/orders?order=sj&year=1870 — the religious orders' footprint,
// read from their members' listings (utils/orders.js: a person belongs to the
// order a suffix on any of their listings marks, so a Jesuit printed once
// without "S.J." still counts).
//   orders    [{id, name, common, members, years: [{year, members, institutions, dioceses}]}]
//   selected  for ?order= and ?year=: {points: [[lat, lng, instID, name, members]],
//             dioceses: [{id, name, members, institutions}]}
let _orderListings = null;
async function orderListings() {
    if (_orderListings) return _orderListings;
    const { orderOfSuffix } = require('../utils/orders');
    const rows = await db.sequelize.query(
        `SELECT pia.persID, pia.suffix, ar.year, ar.instID, ar.instName, ar.instType, ar.diocese, ar.latitude, ar.longitude
           FROM personInAlmanacRecords pia
           JOIN almanacRecords ar ON ar.ID = pia.almanacRecordID
          WHERE pia.persID IS NOT NULL AND ar.year IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    const orderOf = new Map();
    for (const r of rows) {
        const o = orderOfSuffix(r.suffix);
        if (o && !orderOf.has(r.persID)) orderOf.set(r.persID, o.id);
    }
    _orderListings = rows.filter(r => orderOf.has(r.persID)).map(r => ({
        order: orderOf.get(r.persID), pers: r.persID, year: r.year, inst: r.instID,
        name: r.instName || '', type: r.instType || '',
        dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
        lat: r.latitude, lng: r.longitude,
    }));
    return _orderListings;
}

exports.getOrders = async (req, res) => {
    const { ORDERS } = require('../utils/orders');
    const yearParam = parseIntParam(req.query.year, 'year');
    if (yearParam.error) return res.status(400).json({ message: yearParam.error });
    const order = typeof req.query.order === 'string' ? req.query.order : '';
    const key = cacheKey('stats/orders', { order, year: yearParam.value });
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    const listings = await orderListings();
    const names = dioceseNameMap();
    const per = new Map();   // order -> year -> {members, insts, dios}
    const all = new Map();   // order -> members
    for (const l of listings) {
        let byYear = per.get(l.order);
        if (!byYear) per.set(l.order, byYear = new Map());
        let y = byYear.get(l.year);
        if (!y) byYear.set(l.year, y = { members: new Set(), insts: new Set(), dios: new Set() });
        y.members.add(l.pers); y.insts.add(l.inst);
        if (l.dio !== 'unknown') y.dios.add(l.dio);
        if (!all.has(l.order)) all.set(l.order, new Set());
        all.get(l.order).add(l.pers);
    }
    const orders = ORDERS.filter(o => per.has(o.id)).map(o => ({
        id: o.id, name: o.name, common: o.common, members: all.get(o.id).size,
        years: [...per.get(o.id)].sort((a, b) => a[0] - b[0])
            .map(([year, y]) => ({ year, members: y.members.size, institutions: y.insts.size, dioceses: y.dios.size })),
    })).sort((a, b) => b.members - a.members);

    let selected = null;
    if (order && yearParam.value) {
        const places = new Map(), dios = new Map();
        for (const l of listings) {
            if (l.order !== order || l.year !== yearParam.value) continue;
            let p = places.get(l.inst);
            if (!p) places.set(l.inst, p = { lat: l.lat, lng: l.lng, name: l.name, type: l.type, members: new Set() });
            p.members.add(l.pers);
            let d = dios.get(l.dio);
            if (!d) dios.set(l.dio, d = { members: new Set(), insts: new Set() });
            d.members.add(l.pers); d.insts.add(l.inst);
        }
        selected = {
            points: [...places].filter(([, p]) => p.lat && p.lng).map(([id, p]) => [p.lat, p.lng, id, p.name, p.members.size, p.type]),
            dioceses: [...dios].filter(([id]) => id !== 'unknown')
                .map(([id, d]) => ({ id, name: names[id] || id, members: d.members.size, institutions: d.insts.size }))
                .sort((a, b) => b.members - a.members),
        };
    }
    const result = { orders, selected, note: 'Members are the clergy and religious whose names the almanacs print with an order\'s initials (S.J., C.SS.R., O.S.B. …); an order\'s footprint is where they were listed.' };
    networkCache.set(key, result);
    res.send(result);
};

/**
 * GET /api/stats/path?from=&to= — the shortest chain of people linking two
 * records (people or institutions), each step two people listed at the same
 * institution in the same year. See utils/paths.js.
 */
exports.getPath = async (req, res) => {
    const { findPath, MAX_PEOPLE } = require('../utils/paths');
    const from = String(req.query.from || ''), to = String(req.query.to || '');
    // one end alone just names it (the page shows the pick while the other is chosen)
    if (!from && !to) return res.status(400).json({ message: 'from or to is required.' });
    const key = cacheKey('path', { from, to });
    let result = networkCache.get(key);
    if (!result) networkCache.set(key, result = { ...(await findPath(from, to)), maxPeople: MAX_PEOPLE });
    res.json(result);
};

/**
 * GET /api/stats/diocese-check?year=&diocese= — records against the diocese
 * territories drawn for their year (utils/diocese-check.js):
 *   years    [{year, placed, agree}]: records inside some territory, and of
 *            those, inside the one of the diocese they were listed under
 *   pairs    [{listed, listedName, territory, territoryName, count}] for the
 *            year: listed under one diocese, inside another's territory
 *   records  those records for the year (only ones touching `diocese` if given)
 * 404 where the territories haven't been built.
 */
exports.getDioceseCheck = async (req, res) => {
    const { loadCheck, dioceseName } = require('../utils/diocese-check');
    const year = parseInt(req.query.year, 10) || 0;
    const diocese = String(req.query.diocese || '');
    const key = cacheKey('stats/diocese-check', { year, diocese });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    const check = await loadCheck();
    if (!check) return res.status(404).json({ message: 'Diocese territories have not been built (tiles-build dioceses).' });

    const byYear = new Map();
    for (const c of check) {
        if (!c.territory) continue;
        const y = byYear.get(c.year) || { year: c.year, placed: 0, agree: 0 };
        y.placed++;
        if (c.territory === c.listed) y.agree++;
        byYear.set(c.year, y);
    }
    const years = [...byYear.values()].sort((a, b) => a.year - b.year);
    const shown = year || (years.length ? years[years.length - 1].year : 0);

    const off = check.filter(c => c.year === shown && c.territory && c.territory !== c.listed);
    const pairMap = new Map();
    for (const c of off) {
        const k = c.listed + '>' + c.territory;
        const p = pairMap.get(k) || { listed: c.listed, listedName: dioceseName(c.listed, shown),
            territory: c.territory, territoryName: dioceseName(c.territory, shown), count: 0 };
        p.count++;
        pairMap.set(k, p);
    }
    const pairs = [...pairMap.values()].sort((a, b) => b.count - a.count);
    const records = off
        .filter(c => !diocese || c.listed === diocese || c.territory === diocese)
        .map(c => ({ ...c, listedName: dioceseName(c.listed, shown), territoryName: dioceseName(c.territory, shown) }))
        .sort((a, b) => a.listedName.localeCompare(b.listedName) || a.name.localeCompare(b.name));

    const result = { year: shown, years, pairs, records };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/languages — institutions the almanacs marked as serving a
 * language other than English, or a particular people (utils/languages.js).
 * One cached response:
 *   categories  [{id, label, kind, records}]
 *   years       [{year, total, counts: {category: institutions}}]; total is
 *               every institution recorded that year (for shares)
 *   points      [[lat, lng, instID, name, type, year, categories, source, dioceseId]]
 *               (lat/lng null where the record has no place)
 *   dioceses    {id: display name}
 */
let _languages = null;
exports.getLanguages = async (req, res) => {
    if (!_languages) {
        const { CATEGORIES, classify } = require('../utils/languages');
        const rows = await db.sequelize.query(
            `SELECT instID, instName, instType, year, language, instNote, diocese, latitude, longitude
               FROM almanacRecords WHERE year IS NOT NULL`,
            { type: db.Sequelize.QueryTypes.SELECT }
        );
        const byYear = new Map(), totals = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
        const points = [], dioNames = {};
        for (const r of rows) {
            const y = Number(r.year);
            const row = byYear.get(y) || { year: y, total: 0, counts: Object.fromEntries(CATEGORIES.map(c => [c.id, 0])) };
            row.total++;
            byYear.set(y, row);
            const c = classify(r.language, r.instName, r.instNote);
            if (!c) continue;
            for (const id of c.cats) { row.counts[id]++; totals[id]++; }
            const dio = dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown';
            if (!dioNames[dio]) dioNames[dio] = dioceses.meta(dio)?.displayName || dio;
            const lat = Number(r.latitude), lng = Number(r.longitude);
            const placed = r.latitude != null && Number.isFinite(lat) && Number.isFinite(lng);
            points.push([placed ? Math.round(lat * 1e4) / 1e4 : null, placed ? Math.round(lng * 1e4) / 1e4 : null,
                r.instID, r.instName || '', r.instType || '', y, c.cats, c.source, dio]);
        }
        _languages = {
            categories: CATEGORIES.map(c => ({ ...c, records: totals[c.id] })),
            years: [...byYear.values()].sort((a, b) => a.year - b.year),
            points,
            dioceses: dioNames,
        };
    }
    res.json(_languages);
};


/**
 * GET /api/stats/gender?year=&diocese=&kind= — who ran the Church's works
 * (schools, academies, colleges, asylums, hospitals, religious houses) and whom
 * they served, from utils/gender.js. Institutions are counted once a year.
 *   years          [{year, total, run: {women, mixed, men, clergy, lay, unstated},
 *                    served: {girls, boys, both, unstated}}]  (diocese and kind)
 *   kinds          the year's works by kind, each with its run counts (diocese)
 *   congregations  [{id, label, sex, total, years: {year: institutions}}] (diocese and kind)
 *   points         the year's works [lat, lng, instID, name, type, run, served, congregations]
 *   meta           {kinds, run, served, dioceses}, each [{id, label}]
 */
exports.getGender = async (req, res) => {
    const { loadGender, WOMEN, MEN } = require('../utils/gender');
    const { ORDERS } = require('../utils/orders');
    const g = await loadGender();
    const diocese = String(req.query.diocese || '');
    const kind = String(req.query.kind || '');
    const years = [...new Set(g.works.map(w => w.year))].sort((a, b) => a - b);
    const year = years.includes(Number(req.query.year)) ? Number(req.query.year) : years[years.length - 1];
    const key = cacheKey('stats/gender', { year, diocese, kind });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    const inDio = g.works.filter(w => !diocese || w.dio === diocese);
    const sel = inDio.filter(w => !kind || w.kind === kind);
    const zero = list => Object.fromEntries(list.map(x => [x.id, 0]));
    // one row per institution and year (a record listed twice counts once)
    const once = list => {
        const seen = new Set();
        return list.filter(w => !seen.has(w.inst + '|' + w.year) && seen.add(w.inst + '|' + w.year));
    };
    const byYear = new Map(years.map(y => [y, { year: y, total: 0, run: zero(g.run), served: zero(g.served) }]));
    for (const w of once(sel)) {
        const row = byYear.get(w.year);
        row.total++; row.run[w.run]++; row.served[w.served]++;
    }
    const kinds = g.kinds.map(k => ({ ...k, total: 0, run: zero(g.run) }));
    for (const w of once(inDio.filter(w => w.year === year))) {
        const k = kinds.find(k => k.id === w.kind);
        k.total++; k.run[w.run]++;
    }
    const labels = new Map([...WOMEN.map(c => [c.id, { label: c.label, sex: 'women' }]),
        ['unnamed', { label: 'Sisters, not named', sex: 'women' }],
        ...MEN.map(c => [c.id, { label: c.label, sex: 'men' }]),
        ...ORDERS.map(o => [o.id, { label: o.common, sex: 'men' }])]);
    const congs = new Map();
    for (const w of once(sel)) {
        for (const [sex, ids] of [['women', w.women], ['men', w.men]]) {
            for (const id of ids) {
                const k = sex + ':' + id;
                let c = congs.get(k);
                if (!c) {
                    const l = id === 'unnamed' ? { label: sex === 'women' ? 'Sisters, not named' : 'Brothers or fathers, not named' } : labels.get(id) || { label: id };
                    congs.set(k, c = { id, label: l.label, sex, total: 0, years: {} });
                }
                c.total++;
                c.years[w.year] = (c.years[w.year] || 0) + 1;
            }
        }
    }
    const label = (sex, id) => congs.get(sex + ':' + id)?.label || id;
    const points = once(sel.filter(w => w.year === year && w.lat != null)).map(w => [w.lat, w.lng, w.inst, w.name, w.type, w.run, w.served,
        [...w.women.map(id => label('women', id)), ...w.men.map(id => label('men', id))]]);
    const dioIds = [...new Set(g.works.map(w => w.dio))].filter(d => d !== 'unknown');
    const result = {
        year, years: [...byYear.values()], kinds,
        congregations: [...congs.values()].sort((a, b) => (a.sex === b.sex ? 0 : a.sex === 'women' ? -1 : 1) || b.total - a.total),
        points,
        meta: { kinds: g.kinds, run: g.run, served: g.served,
            dioceses: dioIds.map(id => ({ id, label: dioceses.meta(id)?.displayName || id })).sort((a, b) => a.label.localeCompare(b.label)) },
    };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/means?year=&diocese= — paying and charity (utils/means.js):
 * the works by whom they served by means, charities by whom they took, what
 * churches were built of, and every fee and building cost the notes give.
 * Institutions are counted once a year.
 *   years     [{year, works, access: {paying, both, free, parish, charity,
 *              hospital, unstated}, charity: {orphans, …, other}, churches,
 *              material: {stone, brick, frame, log}}]
 *   points    the year's works [lat, lng, instID, name, type, access, charity]
 *   dollars   [{inst, name, type, place, kind: fee|cost|other, amount, perYear, text, years}]
 *   meta      {access, charity, material, dioceses}, each [{id, label}]
 */
exports.getMeans = async (req, res) => {
    const { loadMeans } = require('../utils/means');
    const m = await loadMeans();
    const diocese = String(req.query.diocese || '');
    const years = [...new Set(m.records.map(r => r.year))].sort((a, b) => a - b);
    const year = years.includes(Number(req.query.year)) ? Number(req.query.year) : years[years.length - 1];
    const key = cacheKey('stats/means', { year, diocese });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    const sel = m.records.filter(r => !diocese || r.dio === diocese);
    const zero = list => Object.fromEntries(list.map(x => [x.id, 0]));
    const byYear = new Map(years.map(y => [y, { year: y, works: 0, access: zero(m.access), charity: { ...zero(m.charity), other: 0 },
        churches: 0, material: zero(m.material) }]));
    const seen = new Set();
    for (const r of sel) {
        const k = r.inst + '|' + r.year;
        if (seen.has(k)) continue;
        seen.add(k);
        const row = byYear.get(r.year);
        if (r.access) {
            row.works++; row.access[r.access]++;
            if (r.access === 'charity') {
                if (!r.charity.length) row.charity.other++;
                for (const c of r.charity) row.charity[c]++;
            }
        }
        if (r.material) { row.churches++; row.material[r.material]++; }
    }
    const points = [];
    const shown = new Set();
    for (const r of sel) {
        if (r.year !== year || !r.access || r.lat == null || shown.has(r.inst)) continue;
        shown.add(r.inst);
        points.push([r.lat, r.lng, r.inst, r.name, r.type, r.access, r.charity]);
    }
    // each amount once per institution and wording, with the years it was printed
    const dollars = new Map();
    for (const r of sel) {
        for (const d of r.dollars) {
            const k = `${r.inst}|${d.amount}|${d.kind}`;
            let x = dollars.get(k);
            if (!x) dollars.set(k, x = { inst: r.inst, name: r.name, type: r.type, place: r.place, kind: d.kind, amount: d.amount,
                perYear: d.perYear, text: d.text, years: [] });
            if (!x.years.includes(r.year)) x.years.push(r.year);
        }
    }
    const dioIds = [...new Set(m.records.map(r => r.dio))].filter(d => d !== 'unknown');
    const result = {
        year, years: [...byYear.values()], points,
        dollars: [...dollars.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'fee' ? -1 : 1) || (b.perYear ?? b.amount) - (a.perYear ?? a.amount)),
        meta: { access: m.access, charity: [...m.charity, { id: 'other', label: 'Asylums that do not say' }], material: m.material,
            dioceses: dioIds.map(id => ({ id, label: dioceses.meta(id)?.displayName || id })).sort((a, b) => a.label.localeCompare(b.label)) },
    };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/frontier?year=&diocese= — the Church against the settled
 * country: each year's institutions by distance to the nearest post office
 * then open (utils/frontier.js, from tiles-build frontier), whether the church
 * was listed before that office opened, and the settled places with no
 * institution near them. Counts are of records (one per institution-year).
 *   years     [{year, n, offices, unchurched, bands[5] (≤1, ≤5, ≤15, ≤50 mi,
 *              farther or none), beyond15, measured, churchFirst, medianMiles}]
 *   points    for the year: [lat, lng, instID, miles|null, churchFirst 0|1, isNew 0|1]
 *              (isNew: first listed that year)
 *   unchurched  the year's sample of open offices with no institution within
 *              25 miles: [[lat, lng, name, state]]
 *   farthest  the year's institutions farthest from any office:
 *              [{inst, name, type, place, miles|null, dio}]
 *   dioceses  {id: name}; meta {bands, far}
 */
const FRONTIER_BANDS = [1, 5, 15, 50];
exports.getFrontier = async (req, res) => {
    const { loadFrontier } = require('../utils/frontier');
    const data = loadFrontier();
    if (!data) return res.status(404).json({ message: 'The post offices are not built on this server (tiles-build frontier).' });
    const diocese = typeof req.query.diocese === 'string' ? req.query.diocese : '';
    const yearParam = parseIntParam(req.query.year, 'year');
    if (yearParam.error) return res.status(400).json({ message: yearParam.error });
    const facts = await loadFacts();
    const allYears = [...new Set(facts.map(f => f.y))].sort((a, b) => a - b);
    const year = allYears.includes(yearParam.value) ? yearParam.value : allYears[allYears.length - 1];
    const key = cacheKey('stats/frontier', { year, diocese });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    // when each institution was first listed (branching ids by their child id)
    const listed = firstListed(facts);
    const names = dioceseNameMap();
    const dioceseNames = {};
    const byYear = new Map();
    const points = [], yearRecs = [];
    for (const f of facts) {
        const m = data.records[f.rec];
        if (!m) continue;
        dioceseNames[f._dio] = names[f._dio] || f.d;
        if (diocese && f._dio !== diocese) continue;
        const [miles, est] = m;
        let y = byYear.get(f.y);
        if (!y) {
            const info = data.years[f.y] || { offices: 0, unchurched: 0 };
            byYear.set(f.y, y = { year: f.y, n: 0, offices: info.offices, unchurched: info.unchurched,
                bands: [0, 0, 0, 0, 0], beyond15: 0, measured: 0, churchFirst: 0, miles: [] });
        }
        y.n++;
        const band = miles == null ? 4 : FRONTIER_BANDS.findIndex(b => miles <= b);
        y.bands[band === -1 ? 4 : band]++;
        if (miles == null || miles > 15) y.beyond15++;
        if (miles != null) y.miles.push(miles);
        const first = Math.min(listed.of(f.i), f.y);
        const churchFirst = est != null && first <= est;
        if (est != null) { y.measured++; if (churchFirst) y.churchFirst++; }
        if (f.y === year) {
            if (f.lat != null && f.lng != null) points.push([f.lat, f.lng, f.i, miles, churchFirst ? 1 : 0, listed.isNew(f.i, f.y) ? 1 : 0]);
            yearRecs.push({ inst: f.i, miles, dio: f._dio });
        }
    }
    const years = [...byYear.values()].sort((a, b) => a.year - b.year).map(y => {
        const sorted = y.miles.sort((a, b) => a - b);
        const { miles, ...rest } = y;
        return { ...rest, medianMiles: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null };
    });
    // the year's farthest institutions, named
    const far = yearRecs.sort((a, b) => (b.miles ?? 9999) - (a.miles ?? 9999)).slice(0, 40);
    const named = new Map();
    if (far.length) {
        const rows = await db.sequelize.query(
            `SELECT instID, instName, instType, cityReg, stateReg FROM almanacRecords WHERE year = :year AND instID IN (:ids)`,
            { replacements: { year, ids: far.map(r => r.inst) }, type: db.Sequelize.QueryTypes.SELECT });
        for (const r of rows) named.set(r.instID, r);
    }
    const result = {
        year,
        years,
        points,
        unchurched: (data.years[year] || {}).sample || [],
        farthest: far.map(r => {
            const n = named.get(r.inst) || {};
            return { inst: r.inst, name: n.instName || '', type: n.instType || '', place: [n.cityReg, n.stateReg].filter(Boolean).join(', '),
                miles: r.miles, dio: dioceseNames[r.dio] || r.dio };
        }),
        dioceses: dioceseNames,
        meta: { bands: FRONTIER_BANDS, far: 500 },
    };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/center-periphery?by=diocese|metro|ties&year=&focus= — where
 * the Church's institutions sat between a center and its hinterland
 * (utils/center-periphery.js): the see of each record's diocese, the nearest
 * metro area, or the circuit ties (hub / station). focus narrows to one
 * see's or metro's own hinterland. Records, one per institution-year.
 *   years     [{year, n, rings: {id: n}}]
 *   moves     [{year, toward, away, same}]  resident clergy moves arriving
 *             that year, by whether they went toward the center or away
 *   kinds     for the year: {ring: {kind: n}}
 *   points    for the year: [lat, lng, instID, ring, kind]
 *   centers   for the year (diocese/metro): [{id, name, lat, lng, n, rings: {id: n}}]
 *             (ties): the year's hubs [{inst, name, type, place, stations}]
 *   meta      {rings|ties, kinds, bands, by}
 */
exports.getCenterPeriphery = async (req, res) => {
    const cp = require('../utils/center-periphery');
    const { loadMetros } = require('../utils/metros');
    const { loadMoves } = require('../utils/careers');
    const by = ['diocese', 'metro', 'ties'].includes(req.query.by) ? req.query.by : 'diocese';
    const focus = typeof req.query.focus === 'string' ? req.query.focus : '';
    const yearParam = parseIntParam(req.query.year, 'year');
    if (yearParam.error) return res.status(400).json({ message: yearParam.error });
    const facts = await loadFacts();
    const allYears = [...new Set(facts.map(f => f.y))].sort((a, b) => a - b);
    const year = allYears.includes(yearParam.value) ? yearParam.value : allYears[allYears.length - 1];
    const key = cacheKey('stats/center-periphery', { by, year, focus });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    const names = dioceseNameMap();
    let centers, centerList = [];
    if (by === 'diocese') {
        const at = await seeLocations();
        centers = new Map([...at].map(([id, [lat, lng]]) => [id, { id, lat, lng }]));
        centerList = [...centers.values()].map(c => ({ ...c, name: names[c.id] || c.id }));
    } else if (by === 'metro') {
        centerList = loadMetros().list.map(m => ({ id: m.id, name: `Greater ${m.name}`, lat: m.lat, lng: m.lng }));
        centers = centerList;
    }
    // the circuit ties of each year: hubs and stations
    const hubsByYear = new Map(), stationsByYear = new Map();
    if (by === 'ties') {
        const { links } = await circuitsData();
        for (const [y, hub, st] of links) {
            if (!hubsByYear.has(y)) { hubsByYear.set(y, new Map()); stationsByYear.set(y, new Set()); }
            hubsByYear.get(y).set(hub, (hubsByYear.get(y).get(hub) || 0) + 1);
            stationsByYear.get(y).add(st);
        }
    }
    const placeOf = f => {
        if (by !== 'ties') return cp.place(f, by, centers);
        const hub = hubsByYear.get(f.y)?.has(f.i), st = stationsByYear.get(f.y)?.has(f.i);
        return { center: null, ring: hub && st ? 'both' : hub ? 'hub' : st ? 'station' : 'alone' };
    };
    const ringIds = (by === 'ties' ? cp.TIES : cp.RINGS).map(r => r.id);
    const zero = () => Object.fromEntries(ringIds.map(r => [r, 0]));
    const byYear = new Map(), points = [];
    const kinds = Object.fromEntries(ringIds.map(r => [r, Object.fromEntries(cp.KINDS.map(k => [k.id, 0]))]));
    const perCenter = new Map();
    const seen = new Set();
    for (const f of facts) {
        const dup = f.i + '|' + f.y;
        if (seen.has(dup)) continue;
        seen.add(dup);
        const p = placeOf(f);
        if (focus && p.center !== focus) continue;
        let y = byYear.get(f.y);
        if (!y) byYear.set(f.y, y = { year: f.y, n: 0, rings: zero() });
        y.n++; y.rings[p.ring]++;
        if (f.y === year) {
            const kind = cp.kindOfType(f.t);
            kinds[p.ring][kind]++;
            if (f.lat != null && f.lng != null) points.push([f.lat, f.lng, f.i, p.ring, kind]);
            if (p.center) {
                let c = perCenter.get(p.center);
                if (!c) perCenter.set(p.center, c = { n: 0, rings: zero() });
                c.n++; c.rings[p.ring]++;
            }
        }
    }
    // clergy moves, by direction under this reading (arrivals counted in y2)
    const movesByYear = new Map();
    for (const m of await loadMoves()) {
        const a = placeOf({ ...m.from, i: m.from.inst, y: m.y1, _dio: dioceses.dioceseIdAsListed(m.from.inst, m.from.dio) || 'unknown' });
        const b = placeOf({ ...m.to, i: m.to.inst, y: m.y2, _dio: dioceses.dioceseIdAsListed(m.to.inst, m.to.dio) || 'unknown' });
        if (focus && a.center !== focus && b.center !== focus) continue;
        if (by !== 'ties' && (a.ring === 'remote' && !a.center || b.ring === 'remote' && !b.center)) continue;
        let row = movesByYear.get(m.y2);
        if (!row) movesByYear.set(m.y2, row = { year: m.y2, toward: 0, away: 0, same: 0 });
        const d = cp.RANK[b.ring] - cp.RANK[a.ring];
        row[d < 0 ? 'toward' : d > 0 ? 'away' : 'same']++;
    }
    let centersOut;
    if (by === 'ties') {
        const hubs = [...(hubsByYear.get(year) || new Map())].sort((a, b) => b[1] - a[1]).slice(0, 30);
        const named = new Map();
        if (hubs.length) {
            const rows = await db.sequelize.query(
                `SELECT instID, instName, instType, cityReg, stateReg FROM almanacRecords WHERE year = :year AND instID IN (:ids)`,
                { replacements: { year, ids: hubs.map(h => h[0]) }, type: db.Sequelize.QueryTypes.SELECT });
            for (const r of rows) named.set(r.instID, r);
        }
        centersOut = hubs.map(([inst, stations]) => {
            const n = named.get(inst) || {};
            return { inst, name: n.instName || '', type: n.instType || '', place: [n.cityReg, n.stateReg].filter(Boolean).join(', '), stations };
        });
    } else {
        centersOut = centerList.filter(c => perCenter.has(c.id)).map(c => ({ ...c, ...perCenter.get(c.id) })).sort((a, b) => b.n - a.n);
    }
    const result = {
        by, year,
        years: [...byYear.values()].sort((a, b) => a.year - b.year),
        moves: [...movesByYear.values()].sort((a, b) => a.year - b.year),
        kinds, points, centers: centersOut,
        meta: { rings: by === 'ties' ? cp.TIES : cp.RINGS, kinds: cp.KINDS, bands: cp.BANDS },
    };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/data-issues?check= — things in the data to check or correct,
 * for the Data Issues page:
 *   summary      how many of each
 *   people       person ids that may be one person (utils/people-review.js)
 *   names        person ids listed under more than one surname
 *   places       institutions with years that have no coordinates
 *   prefixes     institution ids whose diocese prefix is not in the timeline
 *   circuits     circuit links over MAX_CIRCUIT_MILES (a misplaced end)
 *   counties     institutions whose recorded county is not the county
 *                their point lies in that year (utils/county-check.js)
 *   wording      notes using words the language, gender or means classifiers
 *                look for that they did not read (new wording to add)
 *   links        institutions with suggested present-day places to review
 *                (utils/links.js)
 * Records outside their diocese's territory come from /stats/diocese-check.
 */
exports.getDataIssues = async (req, res) => {
    const check = String(req.query.check || 'summary');
    const key = cacheKey('stats/data-issues', { check });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);
    const q = sql => db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT });
    const { loadReview } = require('../utils/people-review');

    const builders = {
        people: async () => ({ pairs: (await loadReview()).pairs }),
        names: async () => ({ ids: (await loadReview()).nameConflicts }),
        places: async () => {
            const rows = await q(`SELECT instID, instName, instType, year, cityReg, countyReg, stateReg, placeName, diocese
                                    FROM almanacRecords
                                   WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0) AND year IS NOT NULL
                                   ORDER BY instID, year`);
            const byInst = new Map();
            for (const r of rows) {
                let i = byInst.get(r.instID);
                if (!i) byInst.set(r.instID, i = { inst: r.instID, years: [] });
                // the latest year's details
                Object.assign(i, { name: r.instName || '', type: r.instType || '', diocese: r.diocese || '',
                    place: [r.placeName || r.cityReg, r.countyReg && `${r.countyReg} County`, r.stateReg].filter(Boolean).join(', ') });
                i.years.push(Number(r.year));
            }
            return { records: rows.length, institutions: [...byInst.values()] };
        },
        prefixes: async () => {
            const rows = await q(`SELECT instID, instName, instType, year, diocese FROM almanacRecords WHERE year IS NOT NULL`);
            const out = new Map();
            for (const r of rows) {
                const id = dioceses.canonicalDioceseId(r.instID);
                if (id && dioceses.meta(id)) continue;
                const prefix = id || String(r.instID).split('.').slice(0, 2).join('.');
                let p = out.get(prefix);
                if (!p) out.set(prefix, p = { prefix, records: 0, listedAs: new Set(), examples: [] });
                p.records++;
                if (r.diocese) p.listedAs.add(r.diocese);
                if (p.examples.length < 5 && !p.examples.some(e => e.inst === r.instID)) {
                    p.examples.push({ inst: r.instID, name: r.instName || '', type: r.instType || '', year: Number(r.year) });
                }
            }
            return { prefixes: [...out.values()].map(p => ({ ...p, listedAs: [...p.listedAs] })).sort((a, b) => b.records - a.records) };
        },
        counties: async () => {
            const check = await require('../utils/county-check').loadCountyCheck();
            if (!check) return { available: false };
            return { available: true, ...check };
        },
        // notes that use the words a classifier looks for but were not read by it:
        // new wording to add to utils/languages.js or utils/gender.js
        wording: async () => {
            const { classify } = require('../utils/languages');
            const { unreadGender } = require('../utils/gender');
            const { unreadMeans } = require('../utils/means');
            const LANG_WORD = /\b(german|french|spanish|mexican|polish|italian|bohemian|dutch|irish|indians?|colou?red|negro(es)?|african)\b/i;
            const rows = await q(`SELECT instID, instName, instType, year, language, instNote FROM almanacRecords
                                   WHERE year IS NOT NULL AND instNote IS NOT NULL AND instNote <> '' ORDER BY instID, year`);
            const out = new Map();
            const add = (r, marker, word) => {
                const k = `${r.instID}|${marker}|${String(r.instNote).toLowerCase()}`;
                let x = out.get(k);
                if (!x) {
                    const at = Math.max(0, String(r.instNote).toLowerCase().indexOf(word.toLowerCase()));
                    out.set(k, x = { inst: r.instID, name: r.instName || '', type: r.instType || '', marker, word: word.toLowerCase(),
                        note: String(r.instNote), at, years: [] });
                }
                x.years.push(Number(r.year));
            };
            for (const r of rows) {
                const lw = LANG_WORD.exec(r.instNote);
                if (lw && !classify(r.language, r.instName, r.instNote)) add(r, 'language', lw[1]);
                for (const u of unreadGender(r.instName, r.instType, r.instNote) || []) add(r, u.marker, u.word);
                for (const u of unreadMeans(r.instName, r.instType, r.instNote) || []) add(r, u.marker, u.word);
            }
            return { notes: [...out.values()] };
        },
        links: async () => {
            const links = await require('../utils/links').loadLinks();
            return { available: links.available, osmBase: links.osmBase, institutions: links.review };
        },
        circuits: async () => {
            const { misplaced } = await circuitsData();
            const ids = [...new Set(misplaced.flatMap(m => [m[1], m[2]]))];
            const names = new Map();
            if (ids.length) {
                const rows = await db.sequelize.query(
                    `SELECT instID, year, instName, instType, cityReg, stateReg, latitude, longitude FROM almanacRecords WHERE instID IN (:ids)`,
                    { replacements: { ids }, type: db.Sequelize.QueryTypes.SELECT });
                for (const r of rows) names.set(`${r.instID}|${r.year}`, r);
            }
            const side = (id, year) => {
                const r = names.get(`${id}|${year}`) || {};
                return { inst: id, name: r.instName || '', type: r.instType || '', place: [r.cityReg, r.stateReg].filter(Boolean).join(', '),
                    lat: r.latitude ?? null, lng: r.longitude ?? null };
            };
            return { links: misplaced.map(([year, hub, st, miles]) => ({ year, miles, from: side(hub, year), to: side(st, year) }))
                .sort((a, b) => b.miles - a.miles) };
        },
    };

    let result;
    if (check === 'summary') {
        const review = await loadReview();
        const strength = s => review.pairs.filter(p => p.strength === s && !p.decision).length;
        const [places, prefixes, circuits, wording] = await Promise.all([builders.places(), builders.prefixes(), builders.circuits(), builders.wording()]);
        result = {
            people: { strong: strength('strong'), likely: strength('likely'), possible: strength('possible'),
                decided: review.pairs.filter(p => p.decision).length, people: review.people },
            names: review.nameConflicts.length,
            places: { records: places.records, institutions: places.institutions.length },
            prefixes: prefixes.prefixes.reduce((n, p) => n + p.records, 0),
            circuits: circuits.links.length,
            wording: wording.notes.length,
            // null where the counties aren't built here
            counties: await (async () => {
                const check = await require('../utils/county-check').loadCountyCheck();
                return check ? check.mismatches.length : null;
            })(),
            // institutions with present-day places to review; null where not built here
            links: await (async () => {
                const links = await require('../utils/links').loadLinks();
                if (!links.available) return null;
                const open = links.review.filter(i => !i.decision);
                return { open: open.length, strong: open.filter(i => i.strength === 'strong').length,
                    linked: links.confirmed.size };
            })(),
            // null where the diocese territories aren't built here
            territories: await (async () => {
                const check = await require('../utils/diocese-check').loadCheck();
                return check ? check.filter(c => c.territory && c.territory !== c.listed).length : null;
            })(),
        };
    } else if (builders[check]) {
        result = await builders[check]();
    } else {
        return res.status(400).json({ message: `Unknown check: ${check}` });
    }
    networkCache.set(key, result);
    res.json(result);
};


/**
 * GET /api/stats/turnover?diocese=&fn= — institutions coming and going, how
 * long new ones lasted, and clergy leaving their posts (utils/turnover.js),
 * plus a row per diocese for the table. Cached per filter.
 */
let _residents = null;
exports.getTurnover = async (req, res) => {
    const { buildTurnover, FUNCTIONS } = require('../utils/turnover');
    const diocese = String(req.query.diocese || '');
    const fn = FUNCTIONS.includes(req.query.fn) ? req.query.fn : '';
    const key = cacheKey('stats/turnover', { diocese, fn });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    const facts = await loadFacts();
    if (!_residents) {
        const rows = await db.sequelize.query(
            `SELECT p.persID AS pers, a.instID AS inst, a.year, a.diocese_reg AS diocese
               FROM personInAlmanacRecords p JOIN almanacRecords a ON a.ID = p.almanacRecordID
              WHERE p.isAttending = 0 AND p.persID IS NOT NULL AND a.year IS NOT NULL`,
            { type: db.Sequelize.QueryTypes.SELECT });
        _residents = rows.map(r => ({ pers: r.pers, inst: r.inst, year: Number(r.year),
            dio: dioceses.resolveDioceseId(r.inst, r.diocese) || 'unknown' }));
    }
    const result = buildTurnover(facts, _residents, { diocese, fn });

    // one row per diocese (for the whole collection only): totals over all compared years
    if (!diocese) {
        const names = dioceseNameMap();
        const ids = [...new Set(facts.map(f => f._dio))].filter(id => id !== 'unknown');
        result.dioceses = ids.map(id => {
            const t = buildTurnover(facts, _residents, { diocese: id, fn });
            const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
            const stayed = sum(t.clergy, 'stayed'), left = sum(t.clergy, 'left');
            return { id, name: names[id] || id, added: sum(t.flows, 'added'), gone: sum(t.flows, 'gone'), kept: sum(t.flows, 'kept'),
                departures: stayed + left ? left / (stayed + left) : null, posts: stayed + left, meanStay: t.stays.mean };
        }).filter(d => d.kept + d.added + d.gone > 0).sort((a, b) => a.name.localeCompare(b.name));
        result.dioceseNames = Object.fromEntries(result.dioceses.map(d => [d.id, d.name]));
    }
    result.functions = FUNCTIONS;
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/cessions?year= — the Church against the Indian land cessions
 * (Royce, via the Forest Service; placed by tiles-build cessions into
 * /tiles-data/record-cessions.json). For each record in a cession area: was
 * its land still held by a nation on 1 January of its year (a cession signed
 * later), or how many years since its latest cession?
 *   years     [{year, placed, held, within10, within30, older}] institutions by
 *             the status of their land
 *   missions  for ?year=: the Native American missions (utils/languages.js),
 *             each with its cessions and status
 *   points    for ?year=: [lat, lng, instID, name, type, status, native]
 *   cessions  the cessions those missions stand on {number: {tribes, ceded, dates, present, treaty, schedule}}
 * 404 where the cessions haven't been built.
 */
let _cessionRecords = null;
exports.getCessions = async (req, res) => {
    const year = parseInt(req.query.year, 10) || 0;
    const key = cacheKey('stats/cessions', { year });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);

    if (!_cessionRecords) {
        let placed;
        try {
            placed = JSON.parse(require('fs').readFileSync(process.env.RECORD_CESSIONS || '/tiles-data/record-cessions.json', 'utf8'));
        } catch {
            return res.status(404).json({ message: 'The land cessions have not been built (tiles-build cessions).' });
        }
        const { classify } = require('../utils/languages');
        const rows = await db.sequelize.query(
            `SELECT ID, instID, instName, instType, year, language, instNote, diocese, cityReg, stateReg, latitude, longitude
               FROM almanacRecords WHERE year IS NOT NULL AND latitude IS NOT NULL`,
            { type: db.Sequelize.QueryTypes.SELECT });
        const records = [];
        for (const r of rows) {
            const hits = placed.records[r.ID];
            if (!hits) continue;
            const c = classify(r.language, r.instName, r.instNote);
            records.push({ inst: r.instID, name: r.instName || '', type: r.instType || '', year: Number(r.year),
                place: [r.cityReg, r.stateReg].filter(Boolean).join(', '), lat: Number(r.latitude), lng: Number(r.longitude),
                dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
                native: !!c && c.cats.includes('native'), cessions: hits });
        }
        _cessionRecords = { cessions: placed.cessions, records };
    }
    const { cessions, records } = _cessionRecords;
    // still held on 1 January (a cession signed later), else years since the latest cession
    const status = r => {
        const day = r.year * 10000 + 101;
        const dates = r.cessions.map(n => cessions[n]?.ceded).filter(Boolean);
        if (dates.some(d => d > day)) return { held: true, since: null };
        const latest = Math.max(...dates);
        return { held: false, since: r.year - Math.floor(latest / 10000) };
    };
    const byYear = new Map();
    for (const r of records) {
        const y = byYear.get(r.year) || { year: r.year, placed: 0, held: 0, within10: 0, within30: 0, older: 0 };
        const s = status(r);
        y.placed++;
        if (s.held) y.held++; else if (s.since <= 10) y.within10++; else if (s.since <= 30) y.within30++; else y.older++;
        byYear.set(r.year, y);
    }
    const years = [...byYear.values()].sort((a, b) => a.year - b.year);
    const shown = year || (years.length ? years[years.length - 1].year : 0);
    const names = dioceseNameMap();
    const thisYear = records.filter(r => r.year === shown);
    const missions = thisYear.filter(r => r.native).map(r => ({
        inst: r.inst, name: r.name, type: r.type, place: r.place, diocese: names[r.dio] || r.dio, ...status(r),
        cessions: [...r.cessions].sort((a, b) => (cessions[b]?.ceded || 0) - (cessions[a]?.ceded || 0)),
    })).sort((a, b) => (a.held === b.held ? (a.since ?? 0) - (b.since ?? 0) : a.held ? -1 : 1) || a.name.localeCompare(b.name));
    const used = {};
    for (const m of missions) for (const n of m.cessions) used[n] = cessions[n];
    const result = {
        year: shown, years, missions, cessions: used,
        points: thisYear.map(r => {
            const s = status(r);
            return [Math.round(r.lat * 1e4) / 1e4, Math.round(r.lng * 1e4) / 1e4, r.inst, r.name, r.type,
                s.held ? 'held' : s.since <= 10 ? 'recent' : 'older', r.native ? 1 : 0];
        }),
    };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/stats/southwest?year=&diocese= — the Church on land the United
 * States took from Mexico, with its Hispanic markers (utils/southwest.js):
 *   years     [{year, institutions, spanishNamed, marked, clergy, spanishClergy}]
 *   dioceses  [{id, name, years: [{year, clergy, spanishClergy, institutions}]}]
 *   clergy    for ?year= (and ?diocese=): [{pers, name, spanish, places: [inst name]}]
 *   points    for ?year=: [lat, lng, instID, name, type, how, spanishName, marked, dioceseId]
 *   lands     {how: {label, since}} for the kinds present
 * 404 where the land taken from Mexico hasn't been built (tiles-build history).
 */
exports.getSouthwest = async (req, res) => {
    const year = parseInt(req.query.year, 10) || 0;
    const diocese = String(req.query.diocese || '');
    const key = cacheKey('stats/southwest', { year, diocese });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);
    const { loadSouthwest } = require('../utils/southwest');
    const sw = await loadSouthwest();
    if (!sw.hasLands) return res.status(404).json({ message: 'The land taken from Mexico has not been built (tiles-build history).' });

    const onLand = [...sw.recs.values()].filter(r => r.land);
    const names = dioceseNameMap();
    const byYear = new Map(), byDio = new Map();
    for (const r of onLand) {
        const y = byYear.get(r.year) || { year: r.year, institutions: 0, spanishNamed: 0, marked: 0, clergy: new Set(), spanishClergy: new Set() };
        y.institutions++;
        if (r.spanishName) y.spanishNamed++;
        if (r.spanishMarked) y.marked++;
        byYear.set(r.year, y);
        let d = byDio.get(r.dio);
        if (!d) byDio.set(r.dio, d = { id: r.dio, name: names[r.dio] || r.dio, years: new Map() });
        const dy = d.years.get(r.year) || { year: r.year, institutions: 0, clergy: new Set(), spanishClergy: new Set() };
        dy.institutions++;
        d.years.set(r.year, dy);
        for (const l of sw.atRec.get(r.rec) || []) {
            const p = sw.people.get(l.pers);
            y.clergy.add(l.pers); dy.clergy.add(l.pers);
            if (p?.spanish) { y.spanishClergy.add(l.pers); dy.spanishClergy.add(l.pers); }
        }
    }
    const years = [...byYear.values()].sort((a, b) => a.year - b.year)
        .map(y => ({ ...y, clergy: y.clergy.size, spanishClergy: y.spanishClergy.size }));
    const shown = year || (years.length ? years[years.length - 1].year : 0);
    const dios = [...byDio.values()].map(d => ({
        id: d.id, name: d.name,
        years: [...d.years.values()].sort((a, b) => a.year - b.year)
            .map(y => ({ year: y.year, institutions: y.institutions, clergy: y.clergy.size, spanishClergy: y.spanishClergy.size })),
    })).filter(d => d.years.some(y => y.clergy > 0)).sort((a, b) => a.name.localeCompare(b.name));

    const thisYear = onLand.filter(r => r.year === shown);
    const clergy = new Map();
    for (const r of thisYear) {
        if (diocese && r.dio !== diocese) continue;
        for (const l of sw.atRec.get(r.rec) || []) {
            const p = sw.people.get(l.pers);
            if (!p) continue;
            let c = clergy.get(l.pers);
            if (!c) clergy.set(l.pers, c = { pers: l.pers, name: p.name, spanish: p.spanish, places: [] });
            const label = r.name && !/not recorded/i.test(r.name) ? r.name : r.place || r.type;
            if (label && !c.places.includes(label)) c.places.push(label);
        }
    }
    const LANDS = {
        texas: { label: 'Texas, annexed', since: 18451229 },
        claim: { label: 'claimed by Texas, held by Mexico until the Treaty of Guadalupe Hidalgo', since: 18480704 },
        cession: { label: 'the Mexican Cession, Treaty of Guadalupe Hidalgo', since: 18480704 },
        gadsden: { label: 'the Gadsden Purchase', since: 18531230 },
    };
    const present = new Set(onLand.map(r => r.land.how));
    const result = {
        year: shown, years, dioceses: dios,
        clergy: [...clergy.values()].sort((a, b) => (b.spanish - a.spanish) || a.name.localeCompare(b.name)),
        points: thisYear.filter(r => r.lat != null && r.lng != null && (!diocese || r.dio === diocese))
            .map(r => [Math.round(r.lat * 1e4) / 1e4, Math.round(r.lng * 1e4) / 1e4, r.inst, r.name, r.type, r.land.how, r.spanishName ? 1 : 0, r.spanishMarked ? 1 : 0, r.dio]),
        lands: Object.fromEntries([...present].map(h => [h, LANDS[h]])),
        hasSurnames: sw.hasSurnames,
    };
    networkCache.set(key, result);
    res.json(result);
};
