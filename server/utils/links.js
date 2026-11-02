// Present-day places for the almanacs' institutions: where a parish, school or
// hospital still exists, its website and its place on OpenStreetMap.
//
// Suggestions come from the tile build (tiles/record-links.py →
// /tiles-data/link-candidates.json: OpenStreetMap's Catholic churches, schools,
// colleges, hospitals and convents near each institution whose names share its
// dedication). Nothing is shown on a record page until a person has reviewed it
// on the Data Issues page; the decisions are committed to
// server/data/institution-links.csv, one row per institution:
//   inst, decision (linked | none | unsure), osm (the place chosen, or empty),
//   url (its website, or a link the reviewer gave), reviewer, date,
//   note (the place's present name)
// Built once per process: rebuild the API after editing the CSV.

const fs = require('fs');
const path = require('path');
const db = require('../models');

const DECISIONS_PATH = path.join(__dirname, '..', 'data', 'institution-links.csv');
const STRENGTHS = ['strong', 'likely', 'possible'];

let _links = null;

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and newlines. */
function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(v => v.trim()) && !r[0].startsWith('#'));
}

function readDecisions() {
    const out = new Map();
    let text;
    try { text = fs.readFileSync(DECISIONS_PATH, 'utf8'); } catch { return out; }
    const [head, ...rows] = parseCsv(text);
    if (!head) return out;
    const col = name => head.findIndex(h => h.trim() === name);
    const c = Object.fromEntries(['inst', 'decision', 'osm', 'url', 'reviewer', 'date', 'note'].map(n => [n, col(n)]));
    for (const r of rows) {
        const get = n => (c[n] >= 0 ? r[c[n]] || '' : '').trim();
        if (!get('inst') || !get('decision')) continue;
        // a later row for the same institution replaces an earlier one
        out.set(get('inst'), { decision: get('decision'), osm: get('osm'), url: get('url'),
            reviewer: get('reviewer'), date: get('date'), name: get('note') });
    }
    return out;
}

const osmUrl = osm => osm ? `https://www.openstreetmap.org/${osm}` : null;
const wikipediaUrl = tag => {
    const m = /^([a-z-]+):(.+)$/.exec(String(tag || ''));
    return m ? `https://${m[1]}.wikipedia.org/wiki/${encodeURIComponent(m[2].replace(/ /g, '_'))}` : null;
};

async function loadLinks() {
    if (_links) return _links;
    let candidates = null, osmBase = null;
    try {
        const file = JSON.parse(fs.readFileSync(process.env.LINK_CANDIDATES || '/tiles-data/link-candidates.json', 'utf8'));
        candidates = file.institutions;
        osmBase = file.osmBase;
    } catch { /* not built here: only reviewed links */ }
    const decisions = readDecisions();

    // the review queue: each institution with suggestions, as it was last listed
    let review = [];
    if (candidates) {
        const ids = Object.keys(candidates);
        const rows = ids.length ? await db.sequelize.query(
            `SELECT instID, year, instName, instType, cityReg, stateReg FROM almanacRecords
              WHERE instID IN (:ids) AND year IS NOT NULL ORDER BY instID, year`,
            { replacements: { ids }, type: db.Sequelize.QueryTypes.SELECT }) : [];
        const byInst = new Map();
        for (const r of rows) {
            let i = byInst.get(r.instID);
            if (!i) byInst.set(r.instID, i = { inst: r.instID, years: [], names: new Set() });
            Object.assign(i, { name: r.instName || '', type: r.instType || '', place: [r.cityReg, r.stateReg].filter(Boolean).join(', ') });
            if (r.instName) i.names.add(r.instName);
            if (!i.years.includes(Number(r.year))) i.years.push(Number(r.year));
        }
        review = ids.filter(id => byInst.has(id)).map(id => {
            const i = byInst.get(id);
            const cands = candidates[id].map(c => ({ ...c, osmUrl: osmUrl(c.osm), wikipediaUrl: wikipediaUrl(c.wikipedia) }));
            return { ...i, names: [...i.names], strength: cands[0].strength, score: cands[0].score,
                candidates: cands, decision: decisions.get(id) || null };
        }).sort((a, b) => STRENGTHS.indexOf(a.strength) - STRENGTHS.indexOf(b.strength) || b.score - a.score);
    }

    // what record pages show: reviewed links only
    const confirmed = new Map();
    for (const [inst, d] of decisions) {
        if (d.decision !== 'linked' || !(d.url || d.osm)) continue;
        const cand = (candidates?.[inst] || []).find(c => c.osm === d.osm);
        confirmed.set(inst, {
            name: d.name || cand?.name || '', website: d.url || null, osm: osmUrl(d.osm),
            wikipedia: wikipediaUrl(cand?.wikipedia), checked: d.date || null,
        });
    }
    _links = { available: !!candidates, osmBase, review, confirmed };
    return _links;
}

module.exports = { loadLinks, parseCsv };
