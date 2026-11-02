// The Southwest: the Church on land the United States took from Mexico, and
// three markers of its Hispanic Catholics in the almanacs' own data:
//   - clergy whose surnames are mostly held by Hispanic Americans today
//     (server/data/spanish-surnames.csv, from the 2010 census surname file)
//   - institutions with Spanish names (Nuestra Señora, Guadalupe, San …)
//   - congregations marked Spanish or Mexican (utils/languages.js)
// Which records stand on land taken from Mexico, and how (Texas, the land
// Texas claimed, the Mexican Cession, the Gadsden Purchase), comes from the tile
// build (tiles/record-mexican-lands.py → /tiles-data/mexican-lands.json).
// Built once per process.

const fs = require('fs');
const path = require('path');
const db = require('../models');
const dioceses = require('./dioceses');
const { classify } = require('./languages');

const SURNAMES_PATH = path.join(__dirname, '..', 'data', 'spanish-surnames.csv');
// Spanish place and devotion names, opening an institution's name or after "of" ("Parish Church of San Miguel")
const SPANISH_NAME = /(^|\bof (the )?)(nuestra|nra\.?|n\.\s*s(ra|eñora)|santa|santo|san|santisim|sant[ií]sim|capilla|iglesia|misi[oó]n|parroquia)\b|\b(guadalupe|se[ñn]ora|dolores|purisima|pur[ií]sima|sagrado|santuario|concepci[oó]n|asunci[oó]n|soledad|candelaria|nombre de)\b/i;

let _sw = null;

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z' -]/g, '').trim();

function loadSurnames() {
    const set = new Set();
    try {
        for (const line of fs.readFileSync(SURNAMES_PATH, 'utf8').split('\n')) {
            if (!line || line.startsWith('#') || line.startsWith('name,')) continue;
            set.add(line.split(',')[0]);
        }
    } catch { /* not there: no surname marker */ }
    return set;
}

/** A person's surname as the list spells it ("de Jesus Trujillo" -> TRUJILLO). */
function surnameOf(name, lastName) {
    const s = fold(lastName || String(name || '').split(/\s+/).pop());
    return s.split(/\s+/).pop().replace(/'/g, '');
}

async function loadSouthwest() {
    if (_sw) return _sw;
    let lands = {};
    try {
        lands = JSON.parse(fs.readFileSync(process.env.MEXICAN_LANDS || '/tiles-data/mexican-lands.json', 'utf8')).records;
    } catch {
        lands = null;
    }
    const surnames = loadSurnames();
    const [records, listings] = await Promise.all([
        db.sequelize.query(
            `SELECT ID, instID, instName, instType, year, language, instNote, diocese, cityReg, stateReg, latitude, longitude
               FROM almanacRecords WHERE year IS NOT NULL`,
            { type: db.Sequelize.QueryTypes.SELECT }),
        db.sequelize.query(
            `SELECT p.persID, p.name, p.lastName, p.title, p.isAttending, p.almanacRecordID AS rec
               FROM personInAlmanacRecords p WHERE p.persID IS NOT NULL`,
            { type: db.Sequelize.QueryTypes.SELECT }),
    ]);
    const recs = new Map();
    for (const r of records) {
        const land = lands?.[r.ID] || null;
        const c = classify(r.language, r.instName, r.instNote);
        recs.set(r.ID, {
            rec: r.ID, inst: r.instID, name: r.instName || '', type: r.instType || '', year: Number(r.year),
            place: [r.cityReg, r.stateReg].filter(Boolean).join(', '),
            lat: r.latitude == null ? null : Number(r.latitude), lng: r.longitude == null ? null : Number(r.longitude),
            dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
            land: land ? { how: land[0], since: land[1] } : null,
            spanishName: SPANISH_NAME.test(String(r.instName || '').trim()),
            spanishMarked: !!c && c.cats.includes('spanish'),
        });
    }
    const people = new Map();
    const atRec = new Map();
    for (const l of listings) {
        const rec = recs.get(l.rec);
        if (!rec) continue;
        let p = people.get(l.persID);
        if (!p) {
            const sur = surnameOf(l.name, l.lastName);
            people.set(l.persID, p = { pers: l.persID, name: '', surname: sur, spanish: surnames.has(sur) });
        }
        p.name = [l.title, l.name].filter(Boolean).join(' ') || p.name;
        if (!atRec.has(l.rec)) atRec.set(l.rec, []);
        atRec.get(l.rec).push({ pers: l.persID, visiting: !!l.isAttending });
    }
    _sw = { recs, people, atRec, hasLands: !!lands, hasSurnames: surnames.size > 0 };
    return _sw;
}

module.exports = { loadSouthwest, SPANISH_NAME };
