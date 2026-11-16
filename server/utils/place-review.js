// Places that may be one place: institution ids that may be one institution
// split in two (an 1830s .9xxx id and a later .0xxx id, or a record gap or a
// change of name), and town or county names spelt two ways. Built once per
// process from every almanac record, like people-review.js.
//
// Families: an id's root is its number before any suffix (stl.mo.0209_02 and
// stl.mo.0209_02.01 are children of stl.mo.0209); "&" joins siblings, and
// relatedInstitutions records parents, children and siblings across roots.
// Ids of one family are already known to belong together, so they never pair:
// only ids of different families are suggested.
//
// Pairs: two ids never listed in the same year, at the same town (allowing a
// misspelling) or, where no town is given, the same county. Scored on the
// evidence: for, a shared dedication, the same kind of institution, one
// picking up where the other leaves off, points close together; against, a
// different dedication or kind, points far apart. A different state rules a
// pair out. Each pair says which years of each id lack coordinates and which
// placed year of the other id could fill them, so places already found can be
// reused instead of geocoding again.
//
// Renames: a parish renamed at the moment its id changed shares no saint with
// its old self, so name-free clues at the change carry it: the same resident
// priest listed at both, the only church (school, academy…) of its kind in the
// town the year before and the year after, served from the same mission
// church, the same point, the same number under a new diocese prefix. Of the
// renames already joined under one id, 79% show at least one of the first
// three. With a clue, different saints don't count against a pair, but the
// pair goes in its own list ("renamed"), unranked: whether it is one
// institution renamed or a new one in its place is for a reviewer to say.
//
// Spellings: values of the standardised city_reg / county_reg columns, within
// one state, that differ by a letter or two and lie together (the same
// county, or points within a few miles). Genesee and Geneseo, Illinois are two
// towns: without a shared county or nearby points a pair isn't suggested.
//
// Pairs and spellings already judged (server/data/place-decisions.csv,
// exported from the review page) carry their decision.

const fs = require('fs');
const path = require('path');
const db = require('../models');
const { kindOfType, miles } = require('./center-periphery');
const dioceses = require('./dioceses');

const DECISIONS_PATH = path.join(__dirname, '..', 'data', 'place-decisions.csv');
const MIN_SCORE = 4;          // below this a pair is not worth a reviewer's time
const PER_ID = 3;             // keep each id's best few candidates: a city has hundreds of namesakes
const NEAR_MILES = 5;
const FAR_MILES = 40;
const TOWN_MILES = 12;        // two spellings of one town lie this close
const COUNTY_MILES = 40;

// words that say what kind of institution, not whom it is named for
const GENERIC = new Set(`st sts ss saint saints s the of and a an in at on for to by from with church churches chapel chapels
    cathedral parish congregation station stations mission missions school schools academy academies college seminary
    institute institution unnamed asylum asylums orphan orphans orphanage hospital infirmary convent house home
    female male free day select young ladies gentlemen boys girls children poor sisters brothers society
    literary theological preparatory boarding parochial english german french new old first second third
    st. no county city town township village near diocese parochial`.split(/\s+/).filter(Boolean));
// spellings of one dedication
const FOLD = { virgin: 'mary', lady: 'mary', bvm: 'mary', marys: 'mary', blessed: '', holy: 'holy', sacred: 'sacred',
    peters: 'peter', pauls: 'paul', johns: 'john', josephs: 'joseph', patricks: 'patrick', james: 'james',
    michaels: 'michael', francis: 'francis', xavier: 'xavier', ignatius: 'ignatius', aloysius: 'aloysius',
    vincents: 'vincent', bernards: 'bernard', bridgets: 'bridget', brigids: 'bridget', brigid: 'bridget',
    augustines: 'augustine', austin: 'augustine', nicholas: 'nicholas', anns: 'ann', anne: 'ann', annes: 'ann' };

// words of a dedication that say nothing alone
const WEAK = new Set(['holy', 'sacred', 'name', 'heart']);

let _review = null;

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
/** A town as a key: "Albany City" and "albany" alike; "St. Louis" and "Saint Louis" alike. */
const townKey = s => norm(String(s || '').replace(/\b(saint|ste?)\.?\s/gi, 'st '))
    .replace(/\b(city|town|township|twp|village|borough)\b/g, '').replace(/\s+/g, ' ').trim();
const countyKey = s => townKey(String(s || '').replace(/\b(county|parish|co)\b\.?/gi, ''));
const squash = s => s.replace(/\s/g, '');
/** A name compared without its possessive: "Holy Trinity's" is "Holy Trinity". */
const same = s => norm(String(s || '').replace(/['’]s\b/g, '')).replace(/\s/g, '');

/** The words of a name that say whom it is dedicated to: "St. Mary's Female Academy" → {mary}. */
function dedication(name) {
    const out = new Set();
    for (let w of norm(String(name || '').replace(/'s\b/g, '').replace(/b\.\s*v\.\s*m\./gi, 'bvm')).split(' ')) {
        if (w in FOLD) w = FOLD[w];
        if (w.length > 2 && !GENERIC.has(w)) out.add(w);
    }
    return out;
}

/** Edit distance, stopping early once it can't be under `max`. */
function lev(a, b, max = 9) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (cur[j] < best) best = cur[j];
        }
        if (best > max) return max + 1;
        prev = cur;
    }
    return prev[b.length];
}

/** One name spelt two ways: the same without spaces, or a letter or two apart (about one in five). */
function spelling(a, b) {
    if (a === b) return 'same';
    if (!a || !b) return null;
    if (squash(a) === squash(b)) return 'variant';
    const n = Math.max(a.length, b.length);
    if (n < 5 || a[0] !== b[0]) return null;
    const max = Math.max(1, Math.floor(n / 5));
    return lev(a, b, max) <= max ? 'variant' : null;
}

function readDecisions(file = DECISIONS_PATH) {
    const out = new Map();
    try {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
        const head = parseLine(lines.shift());
        const col = k => head.indexOf(k);
        for (const l of lines) {
            const c = parseLine(l);
            const kind = c[col('kind')], a = c[col('a')], b = c[col('b')], decision = c[col('decision')];
            const where = kind === 'spelling' ? `${c[col('column')] || ''}:${c[col('state')] || ''}` : '';
            if (kind && a && b && decision) out.set(decisionKey(kind, a, b, where), decision);
        }
    } catch { /* no decisions yet */ }
    return out;
}
const decisionKey = (kind, a, b, state = '') => `${kind}|${state}|${[a, b].sort().join('|')}`;

/** A CSV line with quoted fields. */
function parseLine(line) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim());
    return out;
}

async function loadPlaceReview() {
    if (_review) return _review;
    const rows = await db.sequelize.query(
        `SELECT instID, year, instName, instType, cityOrig, cityReg, countyOrig, countyReg, stateOrig, stateReg,
                placeName, latitude, longitude, diocese
           FROM almanacRecords WHERE instID IS NOT NULL AND year IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT });
    const related = await db.sequelize.query(`SELECT firstID, secondID FROM relatedInstitutions`,
        { type: db.Sequelize.QueryTypes.SELECT });
    // resident clergy and mission ties, for the clues at a change of id
    const people = await db.sequelize.query(
        `SELECT a.instID, a.year, p.persID, p.name FROM personInAlmanacRecords p JOIN almanacRecords a ON a.ID = p.almanacRecordID
          WHERE p.isAttending = 0 AND p.persID IS NOT NULL AND a.year IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT });
    const attending = await db.sequelize.query(
        `SELECT d.instID AS station, d.year, h.instID AS hub FROM attendingInstitutions t
           JOIN almanacRecords d ON d.ID = t.attendedInstRecordID JOIN almanacRecords h ON h.ID = t.attendingInstRecordID`,
        { type: db.Sequelize.QueryTypes.SELECT });
    _review = buildPlaceReview(rows, readDecisions(), related, people, attending);
    return _review;
}

const placed = r => r.latitude != null && r.longitude != null && Number(r.latitude) !== 0 && Number(r.longitude) !== 0;
const mostCommon = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
const count = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };

/** The roots an id names: "nyc.ny.0041_02&nyc.ny._03" → [nyc.ny.0041]; "buf.ny.0038&buf.ny.0025" → both. */
function roots(id) {
    return [...new Set(String(id || '').split(/\s*[&=]\s*/)
        .filter(p => /^[a-z]+\.[a-z]{2}\.\d/i.test(p))      // "nyc.ny._03" is a part of the root before it
        .map(p => p.trim().replace(/_.*$/, '')))];
}

/** How deep an id sits in its family by its suffix: 0 a root, 1 root_NN, 2 root_NN.NN. */
function depth(id) {
    const first = String(id).split(/\s*[&=]\s*/)[0];
    return /_\d+\.\d+$/.test(first) ? 2 : /_\d+$/.test(first) ? 1 : 0;
}

/** Families: roots joined by sibling ids and by relatedInstitutions links. */
function families(ids, related) {
    const up = new Map();
    const find = x => { while (up.has(x) && up.get(x) !== x) { up.set(x, up.get(up.get(x)) ?? up.get(x)); x = up.get(x); } return x; };
    const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) up.set(rb, ra); };
    const add = rs => { for (const r of rs) if (!up.has(r)) up.set(r, r); for (const r of rs.slice(1)) join(rs[0], r); };
    for (const id of ids) add(roots(id));
    for (const l of related) { const rs = [...roots(l.firstID), ...roots(l.secondID)]; if (rs.length) add(rs); }
    return id => { const rs = roots(id); return rs.length ? find(rs[0]) : id; };
}

function buildPlaceReview(rows, decisions = new Map(), related = [], people = [], attending = []) {
    const allYears = [...new Set(rows.map(r => Number(r.year)))].sort((a, b) => a - b);
    const prevYear = y => allYears[allYears.indexOf(y) - 1];

    // ---- each id: its names, places and points, year by year ----------------------
    const insts = new Map();
    for (const r of rows) {
        let i = insts.get(r.instID);
        if (!i) insts.set(r.instID, i = { id: r.instID, names: new Map(), types: new Map(), towns: new Map(), shown: new Map(),
            counties: new Map(), states: new Map(), dios: new Map(), byYear: new Map() });
        const y = Number(r.year);
        count(i.names, r.instName);
        count(i.types, r.instType);
        count(i.dios, r.diocese);
        // a town by either column, so a misspelling in one is still found by the other
        for (const t of new Set([r.cityReg, r.cityOrig].filter(Boolean))) {
            const k = townKey(t);
            if (k) { count(i.towns, k); if (!i.shown.has(k)) i.shown.set(k, String(t).trim()); }
        }
        for (const c of new Set([r.countyReg, r.countyOrig].filter(Boolean))) count(i.counties, countyKey(c));
        count(i.states, String(r.stateReg || r.stateOrig || '').trim().toUpperCase().slice(0, 2));
        if (!i.byYear.has(y)) i.byYear.set(y, []);
        i.byYear.get(y).push(r);
    }
    const familyOf = families([...insts.keys()], related);
    for (const i of insts.values()) {
        i.family = familyOf(i.id);
        i.depth = depth(i.id);
        i.years = [...i.byYear.keys()].sort((a, b) => a - b);
        const last = i.byYear.get(i.years[i.years.length - 1])[0];
        i.name = last.instName || mostCommon(i.names);
        i.type = last.instType || mostCommon(i.types);
        i.kind = kindOfType(i.type);
        i.dedication = new Set([...i.names.keys()].flatMap(n => [...dedication(n)]));
        i.state = mostCommon(i.states);
        i.dio = dioceses.canonicalDioceseId(i.id) || '';
        i.town = mostCommon(i.towns);
        i.county = mostCommon(i.counties);
        i.points = i.years.flatMap(y => i.byYear.get(y).filter(placed).slice(0, 1)
            .map(r => ({ year: y, lat: Number(r.latitude), lng: Number(r.longitude) })));
        i.unplaced = i.years.filter(y => !i.byYear.get(y).some(placed));
        i.placeLabel = [i.shown.get(i.town) || '', i.county && !i.town ? `${i.county.replace(/\b\w/g, c => c.toUpperCase())} County` : '', i.state]
            .filter(Boolean).join(', ');
    }

    // ---- clues that don't depend on the name ---------------------------------------
    const add = (m, k, v) => (m.get(k) ?? m.set(k, new Map()).get(k)).set(v.id, v.name);
    const residents = new Map();          // id|year → persID → name
    for (const r of people) add(residents, `${r.instID}|${r.year}`, { id: r.persID, name: r.name || r.persID });
    const hubs = new Map();               // station|year → hub family → hub id
    for (const r of attending) add(hubs, `${r.station}|${r.year}`, { id: familyOf(r.hub), name: r.hub });
    const ofKind = new Map();             // state|town|year|kind → how many ids
    for (const i of insts.values()) if (i.town) for (const y of i.years) {
        const k = `${i.state}|${i.town}|${y}|${i.kind}`;
        ofKind.set(k, (ofKind.get(k) || 0) + 1);
    }
    const ctx = { prevYear, residents, hubs, ofKind };

    // ---- pairs ------------------------------------------------------------------------
    // candidates share a town (first three letters, then spelling) or, with no town, a county
    const blocks = new Map();
    const block = (k, i) => { if (!blocks.has(k)) blocks.set(k, new Set()); blocks.get(k).add(i); };
    for (const i of insts.values()) {
        for (const t of i.towns.keys()) block(`t:${t.slice(0, 3)}`, i);
        if (!i.towns.size) for (const c of i.counties.keys()) if (c) block(`c:${c}`, i);
        // a county-only record can match a town record in that county
        if (i.towns.size) for (const c of i.counties.keys()) if (c) block(`c:${c}`, i);
    }
    const seen = new Set();
    const candidates = [];
    for (const group of blocks.values()) {
        const list = [...group];
        for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
            let a = list[x], b = list[y];
            if (a.years[0] > b.years[0] || (a.years[0] === b.years[0] && a.id > b.id)) [a, b] = [b, a];
            const key = `${a.id}|${b.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const p = scorePair(a, b, ctx);
            if (p) candidates.push(p);
        }
    }
    // each id's best few: in a city, an unnamed 1830s church fits every later church a little
    candidates.sort((x, y) => y.score - x.score);
    const taken = new Map();
    const pairs = [];
    for (const p of candidates) {
        const key = decisionKey('pair', p.a.id, p.b.id);
        const decision = decisions.get(key) || null;
        if (p.score < MIN_SCORE && !decision) continue;
        const na = taken.get(p.a.id) || 0, nb = taken.get(p.b.id) || 0;
        if (!decision && (na >= PER_ID || nb >= PER_ID)) continue;
        taken.set(p.a.id, na + 1); taken.set(p.b.id, nb + 1);
        // pairs named differently are a list of their own: only a person can say whether a
        // place was renamed or replaced, so they aren't ranked with the rest
        pairs.push({ ...p, key, decision, strength: p.rename ? 'renamed' : p.score >= 9 ? 'strong' : p.score >= 6.5 ? 'likely' : 'possible',
            a: side(p.a, p.b), b: side(p.b, p.a) });
    }

    // ---- spellings ------------------------------------------------------------------
    const spellings = [];
    for (const column of ['city', 'county']) {
        const values = new Map();     // state|value → { value, n, insts, counties, lat, lng }
        for (const r of rows) {
            const raw = String((column === 'city' ? r.cityReg : r.countyReg) || '').trim();
            const state = String(r.stateReg || '').trim().toUpperCase().slice(0, 2);
            if (!raw || !state) continue;
            const k = `${state}|${raw}`;
            let v = values.get(k);
            if (!v) values.set(k, v = { state, value: raw, key: column === 'city' ? townKey(raw) : countyKey(raw), n: 0, insts: new Set(),
                counties: new Map(), lat: 0, lng: 0, pts: 0 });
            v.n++;
            v.insts.add(r.instID);
            if (column === 'city') count(v.counties, countyKey(r.countyReg || r.countyOrig));
            if (placed(r)) { v.lat += Number(r.latitude); v.lng += Number(r.longitude); v.pts++; }
        }
        const byState = new Map();
        for (const v of values.values()) {
            if (v.pts) { v.lat /= v.pts; v.lng /= v.pts; }
            if (!byState.has(v.state)) byState.set(v.state, []);
            byState.get(v.state).push(v);
        }
        for (const [state, list] of byState) {
            list.sort((a, b) => a.key.localeCompare(b.key));
            for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
                const a = list[x], b = list[y];
                if (a.key.slice(0, 1) !== b.key.slice(0, 1)) break;
                // the same key ("Albany" / "Albany City") is a standardising choice, not a typo
                if (a.key === b.key) continue;
                if (spelling(a.key, b.key) !== 'variant') continue;
                const d = a.pts && b.pts ? miles(a.lat, a.lng, b.lat, b.lng) : null;
                const sharedCounty = column === 'city' && [...a.counties.keys()].some(c => c && b.counties.has(c));
                const near = d != null && d <= (column === 'city' ? TOWN_MILES : COUNTY_MILES);
                if (d != null && !near) continue;               // two places, both placed apart
                if (!near && !sharedCounty) continue;            // nothing says they're one place
                const [common, rare] = a.n >= b.n ? [a, b] : [b, a];
                const key = decisionKey('spelling', a.value, b.value, `${column}:${state}`);
                spellings.push({
                    key, column, state, miles: d == null ? null : Math.round(d * 10) / 10, sharedCounty,
                    decision: decisions.get(key) || null,
                    suggest: common.value,
                    a: spellingSide(common), b: spellingSide(rare),
                });
            }
        }
    }
    spellings.sort((x, y) => x.state.localeCompare(y.state) || x.a.value.localeCompare(y.a.value));

    // ---- every id, for the year bars --------------------------------------------------
    // compact: one row per id, its years as a bit per almanac year (bit k = years[k])
    const institutions = {
        fields: ['id', 'name', 'type', 'town', 'state', 'dio', 'years', 'family', 'depth'],
        rows: [...insts.values()].map(i => [i.id, i.name, i.type, i.town, i.state, i.dio,
            i.years.reduce((m, y) => m + 2 ** allYears.indexOf(y), 0), i.family, i.depth]),
    };

    return { pairs, spellings, institutions, years: allYears };

    function side(i, other) {
        // each unplaced year, the other id's nearest placed year
        const fills = other.points.length ? i.unplaced.map(y => {
            const p = [...other.points].sort((m, n) => Math.abs(m.year - y) - Math.abs(n.year - y))[0];
            return { year: y, from: p.year, lat: p.lat, lng: p.lng };
        }) : [];
        return { id: i.id, name: i.name, type: i.type, place: i.placeLabel, state: i.state, dio: i.dio, family: i.family,
            // its other names, not the same one spelt with or without an apostrophe
            names: [...new Map([...i.names.keys()].filter(n => n && same(n) !== same(i.name)).map(n => [same(n), n])).values()].slice(0, 3), years: i.years, placedYears: i.points.map(p => p.year),
            unplaced: i.unplaced, fills, town: i.town };
    }
}

function spellingSide(v) {
    return { value: v.value, records: v.n, institutions: [...v.insts].sort() };
}

/** The evidence that two ids are one institution; null when they can't be. */
function scorePair(a, b, { prevYear, residents, hubs, ofKind }) {
    // listed in the same year: two institutions
    if (b.years.some(y => a.byYear.has(y))) return null;
    // one family (a root and its children, or linked siblings) is already known to belong together
    if (a.family === b.family) return null;
    if (a.state && b.state && a.state !== b.state) return null;
    const reasons = [];
    let score = 0;

    // where
    let town = null, townA = '', townB = '';
    for (const t of a.towns.keys()) for (const u of b.towns.keys()) {
        const s = spelling(t, u);
        if (s === 'same' || (s === 'variant' && !town)) { town = s; townA = t; townB = u; }
    }
    if (town === 'same') { score += 2; reasons.push('the same town'); }
    else if (town === 'variant') { score += 1.5; reasons.push(`the town spelt two ways (${a.shown.get(townA)} / ${b.shown.get(townB)})`); }
    else if ([...a.counties.keys()].some(c => c && b.counties.has(c)) && (!a.towns.size || !b.towns.size)) {
        score += 1; reasons.push('the same county');
    } else return null;
    if (a.state && a.state === b.state) score += 0.5;

    const aLast = a.years[a.years.length - 1], bFirst = b.years[0];
    const pa = a.points[a.points.length - 1], pb = b.points[0];
    const d = pa && pb ? miles(pa.lat, pa.lng, pb.lat, pb.lng) : null;

    // clues at the change that don't depend on the name
    const clues = [];
    const ra = residents.get(`${a.id}|${aLast}`), rb = residents.get(`${b.id}|${bFirst}`);
    const priest = ra && rb ? [...ra.keys()].find(p => rb.has(p)) : null;
    if (priest) { score += 3; clues.push(`${ra.get(priest)} listed at both, ${aLast} and ${bFirst}`); }
    const sole = a.kind === b.kind && a.kind !== 'other' && a.town && b.town
        && ofKind.get(`${a.state}|${a.town}|${aLast}|${a.kind}`) === 1 && ofKind.get(`${b.state}|${b.town}|${bFirst}|${b.kind}`) === 1;
    if (sole) { score += 1.5; clues.push(`the only ${KIND_ONE[a.kind]} in the town in ${aLast} and in ${bFirst}`); }
    const ha = hubs.get(`${a.id}|${aLast}`), hb = hubs.get(`${b.id}|${bFirst}`);
    const hub = ha && hb ? [...ha.keys()].find(h => hb.has(h)) : null;
    if (hub) { score += 2; clues.push(`both served from ${ha.get(hub)}`); }
    const num = id => (String(id).match(/^[a-z]+\.[a-z]{2}\.(\d{4}(?:_\d+)*)$/i) || [])[1];
    const sameNumber = num(a.id) && num(a.id) === num(b.id);
    if (sameNumber) { score += 2; clues.push(`the same number, ${num(a.id)}, under a new prefix`); }
    const samePoint = d != null && d <= 0.05;

    // what
    // "holy" or "sacred" alone is not a dedication: Holy Cross and Holy Trinity are two
    const shared = [...a.dedication].filter(w => b.dedication.has(w) && !WEAK.has(w));
    let rename = null;
    if (!a.dedication.size || !b.dedication.size) {
        score += 0.5;
        reasons.push(!a.dedication.size && !b.dedication.size ? 'neither is named' : 'one is not named');
    } else if (shared.length) {
        const exact = shared.length === a.dedication.size && shared.length === b.dedication.size;
        score += exact ? 3 : 2;
        reasons.push(exact ? 'the same dedication' : `both named for ${shared.join(', ')}`);
    } else if (priest || sameNumber || sole || hub || samePoint) {
        // named differently, but something carried over: a reviewer decides whether it is one
        // institution renamed or a new one in its place (often the case for schools and houses)
        rename = { from: a.name, to: b.name };
        reasons.push(`named differently (${a.name} / ${b.name}), but`);
    } else { score -= 2.5; reasons.push('named for different saints'); }
    if (a.kind === b.kind) { score += 1; reasons.push(`both ${KIND_WORDS[a.kind] || 'the same kind'}`); }
    else if (a.kind !== 'other' && b.kind !== 'other') { score -= 3; reasons.push(`${a.type || a.kind} and ${b.type || b.kind}`); }

    // when
    if (prevYear(bFirst) === aLast) {
        if (aLast <= 1840 && bFirst >= 1860) { score += 1.5; reasons.push(`one ends in ${aLast}, the other begins in ${bFirst}, across the gap in the almanacs`); }
        else { score += 2; reasons.push(`one picks up in ${bFirst}, the year after the other ends`); }
    } else { score += 0.5; reasons.push(`one ends in ${aLast}, the other begins in ${bFirst}`); }
    // interleaved years (listed by turns) are not a handover
    if (a.years.some(y => y > bFirst)) { score -= 2; reasons.push('their years interleave'); }

    // the points, where both have them
    if (d != null) {
        if (d <= 0.05) { score += 2; reasons.push('placed at the same point'); }
        else if (d <= NEAR_MILES) { score += 1; reasons.push(`placed ${d.toFixed(1)} miles apart`); }
        else if (d > FAR_MILES) { score -= 3; reasons.push(`placed ${Math.round(d)} miles apart`); }
        else reasons.push(`placed ${Math.round(d)} miles apart`);
    } else if (a.points.length !== b.points.length) {
        reasons.push(`only ${(a.points.length ? a : b).id} has coordinates`);
    }
    // named differently: one sentence with what carried over; otherwise the clues close the list
    const at = reasons.findIndex(r => r.startsWith('named differently'));
    if (at >= 0) {
        const carried = samePoint ? [...clues, 'placed at the same point'] : clues;
        reasons[at] = `${reasons[at]} ${carried.join('; ')}`;
        if (samePoint) reasons.splice(reasons.indexOf('placed at the same point', at + 1), 1);
    } else reasons.push(...clues);
    return { a, b, score: Math.round(score * 10) / 10, reasons, rename };
}

const KIND_ONE = { parish: 'church', station: 'station', school: 'school', academy: 'academy or college',
    charity: 'asylum or hospital', house: 'religious house' };
const KIND_WORDS = { parish: 'churches', station: 'stations', school: 'schools', academy: 'academies or colleges',
    charity: 'asylums or hospitals', house: 'religious houses' };

module.exports = { loadPlaceReview, buildPlaceReview, readDecisions, roots, depth, DECISIONS_PATH, dedication, spelling, townKey };
