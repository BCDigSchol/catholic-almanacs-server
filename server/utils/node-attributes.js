// What the site knows about each institution and person, as short labels for
// the network pages' "Colour by" and their mixing tables. Built once per
// process from every record, like the other classifiers; restart the API
// after a reseed.
//
// Institutions: kind (parish, station, school…: kindOfType of its latest
// type), congregation (the language or people the almanac marked, by the
// languages classifier over all its years; unmarked is English, the
// baseline), ring (how far from its diocese's cathedral, the Center and
// Periphery bands, at its latest placed year).
// People: order (a suffix on any listing: S.J., O.S.B.…), rank (from the
// title of the latest listing).

const db = require('../models');
const dioceses = require('./dioceses');
const { classify, CATEGORIES } = require('./languages');
const { kindOfType, KINDS, RINGS, ringOf, miles } = require('./center-periphery');
const { orderOfSuffix } = require('./orders');

/** The attributes each kind of node can be coloured by, in the order the pages offer them. */
const INSTITUTION_ATTRIBUTES = [
    { id: 'kind', label: 'Kind of institution' },
    { id: 'congregation', label: 'Language or people' },
    { id: 'ring', label: 'Distance band from the cathedral' },
];
const PERSON_ATTRIBUTES = [
    { id: 'order', label: 'Religious order' },
    { id: 'rank', label: 'Rank' },
];

const KIND_LABEL = Object.fromEntries(KINDS.map(k => [k.id, k.label]));
const CONGREGATION_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));
const RING_LABEL = { center: 'Within 5 mi', near: '5–25 mi', hinterland: '25–100 mi', remote: 'Over 100 mi' };
// A point in the lower 48 (a few records carry swapped or zeroed coordinates).
const inUS = (lat, lng) => lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66;

let _institutions = null;
let _people = null;

/** Map(instID → {kind, congregation, ring}). */
async function institutionAttributes() {
    if (_institutions) return _institutions;
    const rows = await db.sequelize.query(
        `SELECT instID, year, instName, instType, language, instNote, diocese, latitude, longitude
           FROM almanacRecords WHERE instID IS NOT NULL AND year IS NOT NULL ORDER BY year`,
        { type: db.Sequelize.QueryTypes.SELECT });

    // each diocese's see: its cathedral (latest), else the median of its institutions
    const see = new Map(), pts = new Map();
    const place = r => {
        const lat = Number(r.latitude), lng = Number(r.longitude);
        return r.latitude != null && Number.isFinite(lat) && Number.isFinite(lng) && inUS(lat, lng) ? [lat, lng] : null;
    };
    for (const r of rows) {
        const p = place(r);
        if (!p) continue;
        const dio = dioceses.resolveDioceseId(r.instID, r.diocese) || 'unknown';
        if (r.instType === 'cathedral') see.set(dio, p);
        const x = pts.get(dio) || [[], []];
        x[0].push(p[0]); x[1].push(p[1]);
        pts.set(dio, x);
    }
    const median = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    for (const [dio, [lats, lngs]] of pts) if (!see.has(dio)) see.set(dio, [median(lats), median(lngs)]);

    const out = new Map();
    const seen = new Map();   // instID → congregation counts
    for (const r of rows) {   // ascending years: later records overwrite
        let a = out.get(r.instID);
        if (!a) out.set(r.instID, a = { kind: KIND_LABEL.other, congregation: 'Not marked (English)', ring: 'No place recorded' });
        a.kind = KIND_LABEL[kindOfType(r.instType)] || KIND_LABEL.other;
        const c = classify(r.language, r.instName, r.instNote);
        if (c) {
            const counts = seen.get(r.instID) || new Map();
            for (const id of c.cats) counts.set(id, (counts.get(id) || 0) + 1);
            seen.set(r.instID, counts);
        }
        const p = place(r);
        const s = see.get(dioceses.resolveDioceseId(r.instID, r.diocese) || 'unknown');
        if (p && s) a.ring = RING_LABEL[ringOf(miles(p[0], p[1], s[0], s[1]))];
    }
    // the congregation it was marked as most often
    for (const [id, counts] of seen) {
        const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
        out.get(id).congregation = CONGREGATION_LABEL[top] || top;
    }
    _institutions = out;
    return out;
}

/** "Rt. Rev." → Bishops; "Very Rev." → Vicars general and other "Very Rev."; "Rev." → Priests. */
function rankOfTitle(title) {
    const t = String(title || '').toLowerCase();
    if (/most rev|rt\.? ?rev|right rev|bishop|archbishop/.test(t)) return 'Bishops';
    if (/very rev/.test(t)) return 'Very Rev. (vicars, superiors)';
    if (/\brev/.test(t)) return 'Priests';
    if (/\b(bro|brother|br)\b/.test(t)) return 'Brothers';
    if (/\b(sr|sister|mother|madame|mme|miss|mrs)\b/.test(t)) return 'Women';
    if (/\b(mr|prof|dr|esq)\b/.test(t)) return 'Laymen';
    return 'No title given';
}

/** Map(persID → {order, rank}). */
async function personAttributes() {
    if (_people) return _people;
    const rows = await db.sequelize.query(
        `SELECT p.persID, p.title, p.suffix, a.year FROM personInAlmanacRecords p
           JOIN almanacRecords a ON a.ID = p.almanacRecordID
          WHERE p.persID IS NOT NULL AND a.year IS NOT NULL ORDER BY a.year`,
        { type: db.Sequelize.QueryTypes.SELECT });
    const out = new Map();
    for (const r of rows) {   // ascending years: the latest title wins; any listing's order counts
        let a = out.get(r.persID);
        if (!a) out.set(r.persID, a = { order: 'No order marked', rank: 'No title given' });
        if (r.title) a.rank = rankOfTitle(r.title);
        const o = orderOfSuffix(r.suffix);
        if (o) a.order = o.common || o.name;
    }
    _people = out;
    return out;
}

module.exports = { institutionAttributes, personAttributes, rankOfTitle, INSTITUTION_ATTRIBUTES, PERSON_ATTRIBUTES };
