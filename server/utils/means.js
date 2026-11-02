// Paying and charity: what the almanacs say about class, without a census.
//
// For the works (schools, academies, colleges, asylums, hospitals; not
// parishes or religious houses alone), whom they served by means, from the
// name, type and note:
//   paying    academies, colleges, boarding and select schools, stated terms
//   free      free schools ("free school", "gratuitous")
//   both      a work keeping both ("select and free schools")
//   charity   asylums and homes: orphans, reform and industrial schools,
//             Good Shepherd refuges, the aged, foundlings, servants, the poor
//   hospital  hospitals and infirmaries (paying and charity patients alike)
//   parish    parish and day schools that say neither
// Charities also carry whom they took (`charity`: orphans, reform, refuge,
// aged, infants, servants, poor). For churches, what the note says they were
// built of (stone, brick, frame or wood, log), a rough mark of a parish's
// means. And every dollar amount: fees (made yearly) and building costs.
//
// Read from the whole database when the API starts, so records added later
// are read the same way; wording the patterns miss shows on the Data Issues
// page (`unreadMeans`).

const db = require('../models');
const { kindOf } = require('./gender');

const PAYING = /\b(free and select|select and free|select (day[- ])?schools?|pay[- ]schools?|paying (pupils|scholars)|boarding[- ]schools?|boarders|board and tuition|terms\b[^.;]{0,30}\$|tuition fees?|per annum|per session|per quarter)\b/;
const FREE = /\bfree[- ](parochial |parish |day )?(schools?|academy)\b|\bfree and select\b|\bselect and free\b|\bgratuitous\b|\bgratis\b|\bfree of charge\b|\bwithout charge\b|\bfree education\b/;
const CHARITY = [
    { id: 'orphans', label: 'Orphans', re: /\borphan|\borphelin/ },
    { id: 'reform', label: 'Reform and industrial schools', re: /\bprotectory|\breform(atory| school)|\bindustrial school|\bhouse of reception|\bjuvenile/ },
    { id: 'refuge', label: 'Good Shepherd and Magdalen refuges', re: /\bgood shepherd\b|\bmagdalen|\bpenitents?\b|\bfallen women\b|\brefuge\b/ },
    { id: 'aged', label: 'The aged, widows and infirm', re: /\baged\b|\bold (people|men|women)\b|\bwidows?\b|\bincurables?\b|\blittle sisters of the poor\b/ },
    { id: 'infants', label: 'Infants and foundlings', re: /\bfoundling|\binfant asylum\b|\binfants?\b/ },
    { id: 'servants', label: 'Servants and working girls', re: /\bservants?\b|\bworking (girls|women)\b|\bout of place\b|\bemployment\b/ },
    { id: 'poor', label: 'The poor and destitute', re: /\bdestitute\b|\bthe poor\b|\bpoor (children|girls|boys|families|persons)\b|\bindigent\b|\bneedy\b/ },
];
const MATERIAL = [
    { id: 'stone', label: 'Stone', re: /\b(stone|granite|marble|brownstone)\b/ },
    { id: 'brick', label: 'Brick', re: /\bbrick\b/ },
    { id: 'frame', label: 'Frame or wood', re: /\b(frame|wooden|wood|timber|clapboard)\b/ },
    { id: 'log', label: 'Log', re: /\blog\b/ },
];
// a material word near the building it describes ("a fine brick church", "the church, of stone")
const BUILT = /\b(church|chapel|building|edifice|structure|cathedral|house of worship)\b/;
const PERIOD = { annum: 1, year: 1, yearly: 1, session: 2, quarter: 4, month: 10, week: 40 };

const ACCESS = [
    { id: 'paying', label: 'Paying' },
    { id: 'both', label: 'Paying and free' },
    { id: 'free', label: 'Free' },
    { id: 'parish', label: 'Parish schools, not stated' },
    { id: 'charity', label: 'Charity' },
    { id: 'hospital', label: 'Hospitals' },
    { id: 'unstated', label: 'Not stated' },
];

/** Every dollar amount in a note: {amount, kind: 'fee' | 'cost' | 'other', perYear, text}. */
function readDollars(note) {
    const out = [];
    const t = String(note || '');
    for (const m of t.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g)) {
        const amount = Number(m[1].replace(/,/g, ''));
        const before = t.slice(Math.max(0, m.index - 60), m.index).toLowerCase();
        const after = t.slice(m.index + m[0].length, m.index + m[0].length + 30).toLowerCase();
        const per = /^\s*(?:per|a|an|each)\s+(annum|year|session|quarter|month|week)/.exec(after)
            || /\b(?:per|a|an|each)\s+(annum|year|session|quarter|month|week)\b[^$]*$/.exec(before);
        let kind = 'other', perYear = null;
        if (per) { kind = 'fee'; perYear = amount * PERIOD[per[1]]; }
        else if (/\b(cost|costing|value|valued|worth|erected|built|sum of|debt|outlay)\b/.test(before)) kind = 'cost';
        else if (/\b(terms|tuition|board)\b/.test(before)) { kind = 'fee'; perYear = amount; }
        out.push({ amount, kind, perYear, text: t.slice(Math.max(0, m.index - 70), m.index + m[0].length + 40).trim() });
    }
    return out;
}

/** What one record says of its means: {access, charity: [ids], material, dollars}. */
function readMeans(name, type, note) {
    const kind = kindOf(type);
    const text = [name, type, note].filter(Boolean).join(' . ').toLowerCase();
    const t = String(type || '').toLowerCase();
    const charity = CHARITY.filter(c => c.re.test(text)).map(c => c.id);
    let access = null;
    if (kind) {
        const paying = PAYING.test(text) || /academy|college|university|boarding/.test(t);
        const free = FREE.test(text) || /free school/.test(t);
        if (kind === 'hospital') access = 'hospital';
        else if (kind === 'asylum' || (charity.length && !paying)) access = 'charity';
        else if (paying && free) access = 'both';
        else if (paying) access = 'paying';
        else if (free) access = 'free';
        else if (kind === 'school') access = 'parish';
        else if (kind !== 'house') access = 'unstated';
        // a religious house alone serves no one here; one that keeps an academy or school is counted by its type
    }
    let material = null;
    if (!kind && note && BUILT.test(String(note).toLowerCase())) {
        const n = String(note).toLowerCase();
        // the material words within a few words of a building word
        for (const m of MATERIAL) {
            const near = new RegExp(`${m.re.source}[^.;]{0,30}${BUILT.source}|${BUILT.source}[^.;]{0,20}\\b(of|in|built of)\\b[^.;]{0,10}${m.re.source}`);
            if (near.test(n)) { material = m.id; break; }
        }
    }
    return { kind, access, charity: access === 'charity' ? charity : [], material, dollars: readDollars(note) };
}

let _means = null;

/** Every record read: {inst, year, name, type, kind, dio, lat, lng, access, charity, material, dollars}. */
async function loadMeans() {
    if (_means) return _means;
    const dioceses = require('./dioceses');
    const rows = await db.sequelize.query(
        `SELECT instID, instName, instType, year, instNote, diocese, cityReg, stateReg, latitude, longitude
           FROM almanacRecords WHERE year IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT });
    const records = [];
    for (const r of rows) {
        const m = readMeans(r.instName, r.instType, r.instNote);
        if (!m.access && !m.material && !m.dollars.length) continue;
        const lat = Number(r.latitude), lng = Number(r.longitude);
        const placed = r.latitude != null && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0;
        records.push({
            inst: r.instID, year: Number(r.year), name: r.instName || '', type: r.instType || '', kind: m.kind,
            place: [r.cityReg, r.stateReg].filter(Boolean).join(', '),
            dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
            lat: placed ? Math.round(lat * 1e4) / 1e4 : null, lng: placed ? Math.round(lng * 1e4) / 1e4 : null,
            access: m.access, charity: m.charity, material: m.material, dollars: m.dollars,
        });
    }
    _means = { records, access: ACCESS, charity: CHARITY.map(({ id, label }) => ({ id, label })),
        material: MATERIAL.map(({ id, label }) => ({ id, label })) };
    return _means;
}

/**
 * Notes about means the patterns did not read: a dollar amount that is neither
 * a fee nor a cost, or words of paying or charity ("charge", "terms", "poor",
 * "pay") on a work counted as not stated or a plain parish school. For the Data Issues page.
 */
function unreadMeans(name, type, note) {
    if (!note) return null;
    const m = readMeans(name, type, note);
    const t = String(note).toLowerCase();
    const out = [];
    const odd = m.dollars.find(d => d.kind === 'other');
    if (odd) out.push({ marker: 'means', word: `$${odd.amount}` });
    // (\"under the charge of\" is who ran it, not a fee)
    const word = /\b(no charge|charged|terms|tuition(?! of)|pay|paid|poor|free|fees?|pensions?)\b/.exec(t);
    if (word && (m.access === 'unstated' || m.access === 'parish')) out.push({ marker: 'means', word: word[1] });
    return out.length ? out : null;
}

module.exports = { loadMeans, readMeans, readDollars, unreadMeans, ACCESS, CHARITY, MATERIAL };
