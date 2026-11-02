// Where each record stood, from the tile build's placements (tiles volume,
// /tiles-data): its historical county of that year (record-counties.json) and
// the Indian land cession(s) its land came from (record-cessions.json) and, in
// the Southwest, how it was taken from Mexico (mexican-lands.json), joined
// to institutions and years. Built once per process; restart the API after
// rebuilding the tiles. Either file may be missing where it isn't built.

const fs = require('fs');
const db = require('../models');

let _places = null;

function readJson(env, file) {
    try {
        return JSON.parse(fs.readFileSync(process.env[env] || `/tiles-data/${file}`, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * {byInst: Map(instID -> [{rec, year, county, cessions, mexico}]),
 *  byCounty: Map(countyId -> {id, name, state, recs: [rec], insts: Set(instID)}),
 *  cessions: {number: {tribes, ceded, dates, present, treaty, schedule}},
 *  hasCounties, hasCessions}
 * county is {id, name, state} or null; cessions a list of numbers, oldest first.
 */
async function loadPlaces() {
    if (_places) return _places;
    const counties = readJson('RECORD_COUNTIES', 'record-counties.json');
    const cessionFile = readJson('RECORD_CESSIONS', 'record-cessions.json');
    const mexican = readJson('MEXICAN_LANDS', 'mexican-lands.json')?.records || {};
    const rows = await db.sequelize.query(
        'SELECT ID, instID, year FROM almanacRecords WHERE year IS NOT NULL',
        { type: db.Sequelize.QueryTypes.SELECT });
    const cessions = cessionFile?.cessions || {};
    const byInst = new Map(), byCounty = new Map();
    for (const r of rows) {
        const c = counties?.records[r.ID];
        const county = c ? { id: c[0], name: c[1], state: c[2] } : null;
        const ces = (cessionFile?.records[r.ID] || []).slice().sort((a, b) => (cessions[a]?.ceded || 0) - (cessions[b]?.ceded || 0));
        const mx = mexican[r.ID] ? { how: mexican[r.ID][0], since: mexican[r.ID][1] } : null;
        if (!county && !ces.length && !mx) continue;
        if (!byInst.has(r.instID)) byInst.set(r.instID, []);
        byInst.get(r.instID).push({ rec: r.ID, year: Number(r.year), county, cessions: ces, mexico: mx });
        if (county) {
            if (!byCounty.has(county.id)) byCounty.set(county.id, { ...county, recs: [], insts: new Set() });
            byCounty.get(county.id).recs.push(r.ID);
            byCounty.get(county.id).insts.add(r.instID);
        }
    }
    for (const list of byInst.values()) list.sort((a, b) => a.year - b.year);
    _places = { byInst, byCounty, cessions, hasCounties: !!counties, hasCessions: !!cessionFile };
    return _places;
}

/** "Desha" -> "desha", "St. Louis" -> "stlouis": for matching a typed county name. */
const countyKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(county|parish)\b/g, '').replace(/^saint\b/, 'st').replace(/[^a-z]/g, '');

/**
 * Counties whose name starts with the query ("Kane", "Kane County", "Kane,
 * Illinois"): [{countyID, name, state, institutions}], exact names first, then
 * the counties with most institutions. Only counties with records.
 */
async function findCounties(query, limit = 10) {
    const [name, state] = String(query || '').split(',').map(x => x.trim());
    const want = countyKey(name);
    if (want.length < 2) return [];
    const wantState = (state || '').toLowerCase();
    const { byCounty } = await loadPlaces();
    return [...byCounty.values()]
        .filter(c => countyKey(c.name).startsWith(want) && (!wantState || c.state.toLowerCase().startsWith(wantState)))
        .map(c => ({ type: 'county', countyID: c.id, name: c.name, state: c.state, institutions: c.insts.size, exact: countyKey(c.name) === want }))
        .sort((a, b) => (b.exact - a.exact) || b.institutions - a.institutions || a.name.localeCompare(b.name))
        .slice(0, limit)
        .map(({ exact, ...c }) => c);
}

module.exports = { loadPlaces, countyKey, findCounties };
