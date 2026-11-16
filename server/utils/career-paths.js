// Careers in aggregate: each person's resident posts in order, sorted into
// categories (the kind of place, or how far it lay from the cathedral), and
// counted from one post to the next. Built once per process from every
// resident listing, like loadMoves.
//
// A post is a run of years at one institution. Where someone is listed at
// several places in one year (a pastor who is also a chaplain), the post
// they already held carries on; otherwise the first by id is taken. Visiting
// (attending) listings are not posts. A change of id for one institution, or
// one person under two ids, breaks or invents a move: the Data Issues queues
// bear on this.

const db = require('../models');
const dioceses = require('./dioceses');
const { kindOfType } = require('./center-periphery');
const { institutionAttributes, personAttributes } = require('./node-attributes');

/** The steps drawn: first post to fourth. */
const STEPS = 4;

const KINDS = [
    { id: 'cathedral', label: 'Cathedral' },
    { id: 'parish', label: 'Parish church' },
    { id: 'station', label: 'Station or mission' },
    { id: 'academy', label: 'Academy, college or seminary' },
    { id: 'school', label: 'School' },
    { id: 'house', label: 'Religious house' },
    { id: 'charity', label: 'Asylum or hospital' },
    { id: 'other', label: 'Other' },
];
const RINGS = [
    { id: 'Within 5 mi', label: 'The cathedral city (within 5 mi)' },
    { id: '5–25 mi', label: 'Near it (5–25 mi)' },
    { id: '25–100 mi', label: 'The hinterland (25–100 mi)' },
    { id: 'Over 100 mi', label: 'Remote (over 100 mi)' },
    { id: 'No place recorded', label: 'No place recorded' },
];

let _careers = null;

/** Map(persID → [{inst, name, kind, ring, dio, from, to}]), posts in order. */
async function loadCareers() {
    if (_careers) return _careers;
    const [rows, rings] = await Promise.all([
        db.sequelize.query(
            `SELECT p.persID, a.instID, a.instName, a.instType, a.year, a.diocese
               FROM personInAlmanacRecords p JOIN almanacRecords a ON a.ID = p.almanacRecordID
              WHERE p.isAttending = 0 AND p.persID IS NOT NULL AND a.year IS NOT NULL AND a.instID IS NOT NULL
              ORDER BY a.year, a.instID`,
            { type: db.Sequelize.QueryTypes.SELECT }),
        institutionAttributes(),
    ]);
    const byPerson = new Map();
    for (const r of rows) {
        const years = byPerson.get(r.persID) ?? byPerson.set(r.persID, new Map()).get(r.persID);
        const y = Number(r.year);
        if (!years.has(y)) years.set(y, []);
        years.get(y).push(r);
    }
    const careers = new Map();
    for (const [pers, years] of byPerson) {
        const posts = [];
        for (const [y, list] of [...years.entries()].sort((a, b) => a[0] - b[0])) {
            const last = posts[posts.length - 1];
            // the post already held carries on; else the year's first listing
            const r = (last && list.find(x => x.instID === last.inst)) || list[0];
            if (last && last.inst === r.instID) { last.to = y; continue; }
            posts.push({
                inst: r.instID, name: r.instName || '', from: y, to: y,
                kind: /cathedral/i.test(r.instType || '') ? 'cathedral' : kindOfType(r.instType),
                ring: rings.get(r.instID)?.ring || 'No place recorded',
                dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
            });
        }
        careers.set(pers, posts);
    }
    _careers = careers;
    return careers;
}

/**
 * The flows between posts for the people selected: `steps[k]` counts the
 * k-th post by category, `links[k]` the moves from post k to k+1, `paths`
 * the commonest runs of the first three posts. Only people with a second post
 * are drawn (a single post has nowhere to flow).
 */
async function buildCareerPaths({ by = 'kind', diocese = '', order = '' } = {}) {
    const [careers, people] = await Promise.all([loadCareers(), personAttributes()]);
    const categories = by === 'ring' ? RINGS : KINDS;
    const cat = p => by === 'ring' ? p.ring : p.kind;
    const label = Object.fromEntries(categories.map(c => [c.id, c.label]));

    const posts = [0, 0, 0, 0];           // people with 1, 2, 3, 4+ posts
    const steps = Array.from({ length: STEPS }, () => ({}));
    const links = Array.from({ length: STEPS - 1 }, () => new Map());
    const paths = new Map();
    let people1 = 0, movers = 0, same = 0, moves = 0;
    for (const [pers, career] of careers) {
        if (order && (people.get(pers)?.order || '') !== order) continue;
        if (diocese && !career.some(p => p.dio === diocese)) continue;
        people1++;
        posts[Math.min(career.length, 4) - 1]++;
        if (career.length < 2) continue;
        movers++;
        const seq = career.slice(0, STEPS).map(cat);
        seq.forEach((c, k) => { steps[k][c] = (steps[k][c] || 0) + 1; });
        for (let k = 0; k + 1 < seq.length; k++) {
            const key = `${seq[k]}|${seq[k + 1]}`;
            links[k].set(key, (links[k].get(key) || 0) + 1);
            moves++;
            if (seq[k] === seq[k + 1]) same++;
        }
        const path = seq.slice(0, 3).join('|');
        paths.set(path, (paths.get(path) || 0) + 1);
    }
    return {
        by, categories,
        steps,
        links: links.map(m => [...m.entries()].map(([k, n]) => { const [from, to] = k.split('|'); return { from, to, n }; })),
        paths: [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
            .map(([k, n]) => ({ path: k.split('|').map(id => ({ id, label: label[id] || id })), n })),
        totals: { people: people1, movers, posts, moves, same },
    };
}

module.exports = { loadCareers, buildCareerPaths, KINDS, RINGS };
