// Clergy careers: every move a person made between resident posts, read from
// the almanacs year by year. Built once per process (like loadFacts) from the
// person listings that aren't visits.
//
// A move: between two consecutive years a person is listed (y1 < y2), they
// left at least one post and took up at least one other. Posts kept while
// adding one (a pastor who also became a college's president) or dropped
// without a new one are not moves. Each departure is paired with each arrival;
// almost always one of each. `gap` marks moves whose two years are more than
// five apart (the 1838–1864 gap in the almanacs), so the move happened
// somewhere in between.

const db = require('../models');
const dioceses = require('./dioceses');

const GAP_YEARS = 5;
let _moves = null;

/** [{pers, name, y1, y2, gap, from: {inst, name, type, dio, lat, lng}, to: {...}}] */
async function loadMoves() {
    if (_moves) return _moves;
    const rows = await db.sequelize.query(
        `SELECT p.persID, p.name, a.year, a.instID, a.instName, a.instType, a.diocese, a.latitude, a.longitude
           FROM personInAlmanacRecords p
           JOIN almanacRecords a ON a.ID = p.almanacRecordID
          WHERE p.isAttending = 0 AND p.persID IS NOT NULL AND a.year IS NOT NULL
          ORDER BY p.persID, a.year`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );

    // person -> year -> Map(instID -> post)
    const people = new Map();
    for (const r of rows) {
        let years = people.get(r.persID);
        if (!years) people.set(r.persID, years = { name: r.name, byYear: new Map() });
        years.name = r.name || years.name;   // latest spelling
        let posts = years.byYear.get(r.year);
        if (!posts) years.byYear.set(r.year, posts = new Map());
        posts.set(r.instID, {
            inst: r.instID,
            name: r.instName || '',
            type: r.instType || '',
            // the diocese as listed that year, not the see it later belonged to
            dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
            lat: r.latitude,
            lng: r.longitude,
        });
    }

    const moves = [];
    for (const [pers, { name, byYear }] of people) {
        const years = [...byYear.keys()].sort((a, b) => a - b);
        for (let i = 1; i < years.length; i++) {
            const [y1, y2] = [years[i - 1], years[i]];
            const before = byYear.get(y1), after = byYear.get(y2);
            const left = [...before.keys()].filter(k => !after.has(k));
            const took = [...after.keys()].filter(k => !before.has(k));
            if (!left.length || !took.length) continue;
            for (const a of left) for (const b of took) {
                moves.push({ pers, name, y1, y2, gap: y2 - y1 > GAP_YEARS, from: before.get(a), to: after.get(b) });
            }
        }
    }
    _moves = moves;
    return moves;
}

module.exports = { loadMoves, GAP_YEARS };
