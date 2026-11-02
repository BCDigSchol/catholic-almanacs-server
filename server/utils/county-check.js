// Records against the counties of their year: the county the almanac (or its
// transcription) gave, against the county the record's point lies in on
// 1 January of its year, from the Newberry's historical counties. The tile build
// (tiles/build-counties.sh) places every record and writes
// record-counties.json into the tiles volume. Built once per process.

const fs = require('fs');
const db = require('../models');

let _check = null;

/** "St. Lawrence County" -> "stlawrence"; "Orleans Parish" -> "orleans". */
const key = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(county|parish|co\.?|district|borough|of)\b/g, '').replace(/m'/g, 'mc').replace(/^saint\b/, 'st').replace(/[^a-z]/g, '');

/** One name spelt two ways ("Potawatamie" / "Pottawattamie", "Alleghany" / "Allegany"): they start alike or differ in under a third of their letters. */
function sameName(a, b) {
    if (a === b || a.includes(b) || b.includes(a)) return true;
    if (a.length >= 4 && b.length >= 4 && a.slice(0, 3) === b.slice(0, 3)) return true;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length] <= Math.max(2, Math.floor(Math.max(a.length, b.length) / 3));
}

function loadPlaced() {
    const file = process.env.RECORD_COUNTIES || '/tiles-data/record-counties.json';
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')).records;
    } catch {
        return null;   // not built here
    }
}

/**
 * {placed, agree, unrecorded, mismatches: [{inst, name, type, place, years, recorded, county, state}]}
 * or null where the counties haven't been built. A mismatch row is one
 * institution with the years its recorded county and its year's county differ.
 */
async function loadCountyCheck() {
    if (_check) return _check;
    const placed = loadPlaced();
    if (!placed) return null;
    const rows = await db.sequelize.query(
        `SELECT ID, instID, instName, instType, year, countyOrig, countyReg, cityReg, stateReg
           FROM almanacRecords WHERE year IS NOT NULL AND latitude IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT });
    let inCounty = 0, agree = 0, unrecorded = 0;
    const byInst = new Map();
    for (const r of rows) {
        const p = placed[r.ID];
        if (!p) continue;
        inCounty++;
        // either column may be right: the printed one has slips ("Morehouseville County"), the
        // regularized one sometimes today's county (Lackawanna for 1864)
        const written = [r.countyOrig, r.countyReg].filter(c => c && key(c));
        if (!written.length) { unrecorded++; continue; }
        const [, county, state] = p;
        if (written.some(c => sameName(key(c), key(county)))) { agree++; continue; }
        const recorded = written[0];
        const k = `${r.instID}|${key(recorded)}|${key(county)}`;
        let m = byInst.get(k);
        if (!m) byInst.set(k, m = { inst: r.instID, name: r.instName || '', type: r.instType || '',
            place: [r.cityReg, r.stateReg].filter(Boolean).join(', '), recorded, county, state, years: [] });
        m.years.push(Number(r.year));
    }
    _check = {
        placed: inCounty, agree, unrecorded,
        mismatches: [...byInst.values()].sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county)),
    };
    return _check;
}

module.exports = { loadCountyCheck };
