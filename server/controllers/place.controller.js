// Places: each institution's county and ceded land by year, and a page per
// historical county, and per metro area (utils/metros.js), gathering
// everything the almanacs recorded there. Built on utils/places.js (the tile
// build's placements).

const db = require('../models');
const dioceses = require('../utils/dioceses');
const { loadPlaces } = require('../utils/places');
const { loadMetros } = require('../utils/metros');
const { networkCache, cacheKey } = require('../utils/network');

/**
 * GET /api/institution/:id/land — for each year of the institution (and of the
 * institutions it branched into, "a&b"), its county that year and the
 * cessions its land came from:
 *   {years: [{year, county: {id, name, state} | null, metro: {id, name} | null, cessions: [{number, tribes, ceded, treaty, schedule, present}],
 *     mexico: {how: texas|claim|cession|gadsden, since: yyyymmdd} | null}]}
 */
exports.getInstitutionLand = async (req, res) => {
    const places = await loadPlaces();
    const id = String(req.params.id);
    const ids = [id, ...id.split(/[&=]/)].filter(Boolean);
    const rows = [...new Set(ids)].flatMap(i => places.byInst.get(i) || []);
    const byYear = new Map();
    for (const r of rows) if (!byYear.has(r.year)) byYear.set(r.year, r);
    res.json({
        years: [...byYear.values()].sort((a, b) => a.year - b.year).map(r => ({
            year: r.year,
            county: r.county,
            metro: (m => m ? { id: m.id, name: m.name } : null)(r.county && loadMetros().byCounty.get(r.county.id)),
            cessions: r.cessions.map(n => ({ number: n, ...places.cessions[n] })),
            mexico: r.mexico,
        })),
    });
};

/**
 * GET /api/institution/:id/links — where the institution is today, if a
 * reviewer has confirmed it (utils/links.js): {links: [{name, website, osm,
 * wikipedia, checked}]}. Empty until reviewed.
 */
exports.getInstitutionLinks = async (req, res) => {
    const { confirmed } = await require('../utils/links').loadLinks();
    const id = String(req.params.id);
    const ids = [...new Set([id, ...id.split(/[&=]/)].filter(Boolean))];
    res.json({ links: ids.map(i => confirmed.get(i)).filter(Boolean) });
};

/**
 * Everything the almanacs recorded at a set of records (a county's, or a
 * metro's counties'): its institutions (each with the county it lay in), the
 * clergy listed at them, their dioceses and the cessions under them.
 */
async function gather(recs, places) {
    const [records, listings] = await Promise.all([
        db.sequelize.query(
            `SELECT ID, instID, instName, instType, year, cityReg, placeName, diocese, latitude, longitude
               FROM almanacRecords WHERE ID IN (:recs)`,
            { replacements: { recs }, type: db.Sequelize.QueryTypes.SELECT }),
        db.sequelize.query(
            `SELECT p.persID, p.name, p.title, p.isAttending, a.instID, a.year
               FROM personInAlmanacRecords p JOIN almanacRecords a ON a.ID = p.almanacRecordID
              WHERE p.almanacRecordID IN (:recs) AND p.persID IS NOT NULL`,
            { replacements: { recs }, type: db.Sequelize.QueryTypes.SELECT }),
    ]);

    const countyOf = new Map();
    for (const list of places.byInst.values()) for (const p of list) if (p.county) countyOf.set(p.rec, p.county);

    const insts = new Map(), dios = new Map(), cessionNums = new Set(), years = new Map();
    for (const r of records.sort((a, b) => a.year - b.year)) {
        const y = Number(r.year);
        let i = insts.get(r.instID);
        if (!i) insts.set(r.instID, i = { inst: r.instID, years: [], dioceses: [] });
        // the latest year's name, place, point and county
        const c = countyOf.get(r.ID);
        Object.assign(i, { name: r.instName || '', type: r.instType || '', place: r.cityReg || r.placeName || '',
            lat: r.latitude == null ? null : Number(r.latitude), lng: r.longitude == null ? null : Number(r.longitude),
            county: c ? { id: c.id, name: c.name, state: c.state } : null });
        if (!i.years.includes(y)) i.years.push(y);
        const dio = dioceses.dioceseIdAsListed(r.instID, r.diocese);
        if (dio) {
            const name = dioceses.meta(dio)?.namesByYear?.[y] || dioceses.meta(dio)?.displayName || r.diocese;
            // one name per spelling ("Saut-Saint-Marie" / "Saut Sainte Marie")
            const k = String(name).toLowerCase().replace(/sainte?/g, 'st').replace(/[^a-z]/g, '');
            if (!i.dioceses.some(n => String(n).toLowerCase().replace(/sainte?/g, 'st').replace(/[^a-z]/g, '') === k)) i.dioceses.push(name);
            if (!dios.has(dio)) dios.set(dio, { id: dio, name: dioceses.meta(dio)?.displayName || r.diocese, years: [] });
            if (!dios.get(dio).years.includes(y)) dios.get(dio).years.push(y);
        }
        const year = years.get(y) || { year: y, institutions: new Set(), people: new Set() };
        year.institutions.add(r.instID);
        years.set(y, year);
        for (const p of places.byInst.get(r.instID) || []) if (p.rec === r.ID) p.cessions.forEach(n => cessionNums.add(n));
    }
    const people = new Map();
    for (const l of listings) {
        const y = Number(l.year);
        let p = people.get(l.persID);
        if (!p) people.set(l.persID, p = { pers: l.persID, name: '', years: [], institutions: [], visiting: true });
        p.name = [l.title, l.name].filter(Boolean).join(' ') || p.name;
        if (!p.years.includes(y)) p.years.push(y);
        if (!p.institutions.includes(l.instID)) p.institutions.push(l.instID);
        if (!l.isAttending) p.visiting = false;
        years.get(y)?.people.add(l.persID);
    }
    return {
        years: [...years.values()].sort((a, b) => a.year - b.year)
            .map(y => ({ year: y.year, institutions: y.institutions.size, people: y.people.size })),
        institutions: [...insts.values()].sort((a, b) => a.years[0] - b.years[0] || a.name.localeCompare(b.name)),
        people: [...people.values()].map(p => ({ ...p, years: p.years.sort((a, b) => a - b) }))
            .sort((a, b) => a.years[0] - b.years[0] || a.name.localeCompare(b.name)),
        dioceses: [...dios.values()].map(d => ({ ...d, years: d.years.sort((a, b) => a - b) })),
        cessions: [...cessionNums].map(n => ({ number: n, ...places.cessions[n] })).sort((a, b) => a.ceded - b.ceded),
    };
}

/**
 * GET /api/place/county/:id — a historical county (the Newberry atlas's id,
 * e.g. "ohs_noble") and everything the almanacs recorded in it:
 *   county       {id, name, state}
 *   metro        the metro area it is part of, {id, name}, or null
 *   years        [{year, institutions, people}]
 *   institutions [{inst, name, type, place, dioceses, years, lat, lng, county}]
 *   people       [{pers, name, years, institutions}]  (resident and visiting)
 *   dioceses     [{id, name, years}]
 *   cessions     the cessions under its land [{number, tribes, ceded, treaty, schedule, present}]
 */
exports.getCounty = async (req, res) => {
    const id = String(req.params.id);
    const key = cacheKey('place/county', { id });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);
    const places = await loadPlaces();
    const county = places.byCounty.get(id);
    if (!county) return res.status(404).json({ message: places.hasCounties ? `No records lie in county ${id}.` : 'The historical counties have not been built here.' });

    const metro = loadMetros().byCounty.get(id);
    const result = {
        county: { id: county.id, name: county.name, state: county.state },
        metro: metro ? { id: metro.id, name: metro.name } : null,
        ...await gather(county.recs, places),
    };
    networkCache.set(key, result);
    res.json(result);
};

/**
 * GET /api/place/metro/:id — a metro area (server/data/metros.csv: a city and
 * the counties around it, as drawn for this site) and everything the almanacs
 * recorded in its counties, as for a county page, plus:
 *   metro     {id, name, state, also, lat, lng, populations: {year: n}}
 *   counties  [{id, name, state, institutions}] its counties with records
 *   others    the other metros [{id, name, state}]
 */
exports.getMetro = async (req, res) => {
    const id = String(req.params.id);
    const key = cacheKey('place/metro', { id });
    const cached = networkCache.get(key);
    if (cached) return res.json(cached);
    const metros = loadMetros();
    const metro = metros.byId.get(id);
    if (!metro) return res.status(404).json({ message: `No metro area ${id}.` });
    const places = await loadPlaces();
    if (!places.hasCounties) return res.status(404).json({ message: 'The historical counties have not been built here.' });
    const counties = metro.counties.map(c => places.byCounty.get(c)).filter(Boolean);
    const result = {
        metro: { id: metro.id, name: metro.name, state: metro.state, also: metro.also, lat: metro.lat, lng: metro.lng, populations: metro.populations },
        counties: counties.map(c => ({ id: c.id, name: c.name, state: c.state, institutions: c.insts.size }))
            .sort((a, b) => b.institutions - a.institutions),
        others: metros.list.filter(m => m.id !== id).map(m => ({ id: m.id, name: m.name, state: m.state })),
        ...await gather(counties.flatMap(c => c.recs), places),
    };
    networkCache.set(key, result);
    res.json(result);
};

/** GET /api/place/metros — every metro area: {metros: [{id, name, state, also, population1870, institutions}]}. */
exports.getMetros = async (req, res) => {
    const places = await loadPlaces();
    res.json({ metros: loadMetros().list.map(m => {
        const insts = new Set();
        for (const c of m.counties) for (const i of places.byCounty.get(c)?.insts || []) insts.add(i);
        return { id: m.id, name: m.name, state: m.state, also: m.also, population1870: m.populations[1870], institutions: insts.size };
    }) });
};
