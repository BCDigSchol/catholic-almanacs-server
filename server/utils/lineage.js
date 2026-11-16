// Who served under whom: ties from a junior to the head of the institution
// where both were resident in the same almanac year, read from the roles the
// almanac printed. Built once per process, like loadMoves.
//
//   under      a record with exactly one head (pastor, rector, superior,
//              president, prior, abbot, director…; not "assistant" or "vice-"):
//              every other resident there served under them
//   assistant  the stricter reading: only residents whose role says assistant
//              (or curate, vice-…), under the one head, or under the one other
//              resident where no head is named
//
// Most listings carry no role (25,000 of 33,000), and a record with no named
// head, or with two, gives no tie, so this is a part of who served under whom,
// not the whole. Chains follow people who served under someone and later
// headed a place themselves.

const db = require('../models');

const HEAD = /\b(pastor|rector|superior|superiour|sup\.|president|prior|abbot|director|principal|superintendent|guardian|superioress|directress|prioress|sister[- ]servant|bishop|archbishop)\b/i;
const ASSISTANT = /assist|ass't|asst|curate|vice|sub-?prior|coadjutor/i;

let _lineage = null;

/** {ties: {under: Tie[], assistant: Tie[]}, people: Map(persID → {name, diocese})}; Tie = {junior, senior, years[], places[{inst, name}]}. */
async function loadLineage() {
    if (_lineage) return _lineage;
    const rows = await db.sequelize.query(
        `SELECT p.almanacRecordID AS rec, p.persID, p.name, p.role, a.instID, a.instName, a.year, a.diocese_reg AS diocese
           FROM personInAlmanacRecords p JOIN almanacRecords a ON a.ID = p.almanacRecordID
          WHERE p.isAttending = 0 AND p.persID IS NOT NULL AND a.year IS NOT NULL ORDER BY a.year`,
        { type: db.Sequelize.QueryTypes.SELECT });
    const people = new Map();
    const records = new Map();
    for (const r of rows) {
        // ascending years: the latest name and diocese win
        people.set(r.persID, { name: r.name || r.persID, diocese: (r.diocese || '').trim() || 'Unknown' });
        if (!records.has(r.rec)) records.set(r.rec, []);
        records.get(r.rec).push(r);
    }
    const build = mode => {
        const ties = new Map();
        const add = (junior, senior) => {
            if (junior.persID === senior.persID) return;
            const k = `${junior.persID}|${senior.persID}`;
            let t = ties.get(k);
            if (!t) ties.set(k, t = { junior: junior.persID, senior: senior.persID, years: [], places: new Map() });
            const y = Number(junior.year);
            if (!t.years.includes(y)) t.years.push(y);
            t.places.set(junior.instID, junior.instName || '');
        };
        for (const list of records.values()) {
            const role = p => String(p.role || '');
            const heads = list.filter(p => HEAD.test(role(p)) && !ASSISTANT.test(role(p)));
            const assistants = list.filter(p => ASSISTANT.test(role(p)));
            const others = list.filter(p => !heads.includes(p) && !assistants.includes(p));
            if (mode === 'assistant') {
                const head = heads.length === 1 ? heads[0] : !heads.length && others.length === 1 ? others[0] : null;
                if (head) for (const a of assistants) add(a, head);
            } else if (heads.length === 1) {
                for (const p of [...assistants, ...others]) add(p, heads[0]);
            }
        }
        return [...ties.values()].map(t => ({ ...t, places: [...t.places.entries()].map(([inst, name]) => ({ inst, name })) }));
    };
    _lineage = { ties: { under: build('under'), assistant: build('assistant') }, people };
    return _lineage;
}

/** The first year of a tie: when the junior began under the senior. */
const began = t => Math.min(...t.years);

/**
 * Everyone above and below one person, as nested lists: `up` those they
 * served under (and those those had served under before…), `down` those who
 * served under them (and those who later served under those…). Lines run
 * forward in time: a step up must have begun before the step below it, a step
 * down after the one above, which also keeps communities that rotated their
 * superiors from looping.
 */
function lineageTree(ties, people, focus, maxDepth = 8) {
    const above = new Map(), below = new Map();
    const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
    for (const t of ties) { push(above, t.junior, t); push(below, t.senior, t); }
    const span = ys => {
        const s = [...ys].sort((a, b) => a - b);
        return s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : String(s[0]);
    };
    const walk = (id, map, other, ok, depth) => (map.get(id) || [])
        .filter(ok)
        .sort((a, b) => began(a) - began(b))
        .map(t => ({
            id: t[other], label: people.get(t[other])?.name || t[other], years: span(t.years),
            place: t.places[0] || null, morePlaces: Math.max(0, t.places.length - 1),
            children: depth >= maxDepth ? [] : walk(t[other], map, other,
                other === 'senior' ? x => began(x) < began(t) : x => began(x) > began(t), depth + 1),
        }));
    return {
        up: walk(focus, above, 'senior', () => true, 1),
        down: walk(focus, below, 'junior', () => true, 1),
    };
}

/**
 * For every person others served under: how many directly, and how many in
 * all down their line (those who served under them, then those who later
 * served under those, and so on, forward in time).
 */
function lineCounts(ties) {
    const below = new Map();
    for (const t of ties) (below.get(t.senior) ?? below.set(t.senior, []).get(t.senior)).push(t);
    const out = new Map();
    for (const [id, direct] of below) {
        // the earliest year each person joins the line (earlier lets more follow)
        const joined = new Map();
        const queue = direct.map(t => [t.junior, began(t)]);
        for (let i = 0; i < queue.length; i++) {
            const [who, year] = queue[i];
            if (who === id || (joined.has(who) && joined.get(who) <= year)) continue;
            joined.set(who, year);
            for (const t of below.get(who) || []) if (began(t) > year) queue.push([t.junior, began(t)]);
        }
        out.set(id, { under: new Set(direct.map(t => t.junior)).size, line: joined.size });
    }
    return out;
}

/** The longest chains of service, junior first, each step up begun before the one below: [[id, …], …], up to `n`, sharing no one. */
function longestChains(ties, n = 5) {
    const above = new Map();
    for (const t of ties) (above.get(t.junior) ?? above.set(t.junior, []).get(t.junior)).push(t);
    const memo = new Map();
    const best = (id, before) => {
        const key = `${id}|${before}`;
        if (memo.has(key)) return memo.get(key);
        let chain = [id];
        for (const t of above.get(id) || []) {
            if (began(t) >= before) continue;
            const c = best(t.senior, began(t));
            if (c.length + 1 > chain.length) chain = [id, ...c];
        }
        memo.set(key, chain);
        return chain;
    };
    const chains = [...above.keys()].map(id => best(id, Infinity)).sort((a, b) => b.length - a.length);
    const out = [], used = new Set();
    for (const c of chains) {
        if (c.length < 3 || c.some(id => used.has(id))) continue;
        out.push(c);
        c.forEach(id => used.add(id));
        if (out.length >= n) break;
    }
    return out;
}

module.exports = { loadLineage, lineageTree, lineCounts, longestChains };
