// "How are these two connected?": the shortest chain of people linking two
// records, where each step is two people the almanac listed at the same
// institution in the same year (resident or visiting). Either end can be a
// person or an institution. The listings are read once per process, like
// loadFacts.

const db = require('../models');

const MAX_PEOPLE = 12;   // longest chain looked for
let _graph = null;

/** persons: id -> {name, title, suffix, at: Map(instID -> Set(year))}; insts: id -> {name, type, place, byYear: Map(year -> Set(persID))} */
async function loadGraph() {
    if (_graph) return _graph;
    const rows = await db.sequelize.query(
        `SELECT p.persID, p.name, p.title, p.suffix, a.year, a.instID, a.instName, a.instType, a.cityReg, a.stateReg
           FROM personInAlmanacRecords p
           JOIN almanacRecords a ON a.ID = p.almanacRecordID
          WHERE p.persID IS NOT NULL AND a.instID IS NOT NULL AND a.year IS NOT NULL
          ORDER BY a.year`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    const persons = new Map(), insts = new Map();
    for (const r of rows) {
        let p = persons.get(r.persID);
        if (!p) persons.set(r.persID, p = { at: new Map() });
        // rows come in year order: keep the latest spelling
        p.name = r.name || p.name; p.title = r.title || p.title; p.suffix = r.suffix || p.suffix;
        if (!p.at.has(r.instID)) p.at.set(r.instID, new Set());
        p.at.get(r.instID).add(r.year);

        let i = insts.get(r.instID);
        if (!i) insts.set(r.instID, i = { byYear: new Map() });
        i.name = r.instName || i.name; i.type = r.instType || i.type;
        if (r.cityReg || r.stateReg) i.place = [r.cityReg, r.stateReg].filter(Boolean).join(', ');
        if (!i.byYear.has(r.year)) i.byYear.set(r.year, new Set());
        i.byYear.get(r.year).add(r.persID);
    }
    _graph = { persons, insts };
    return _graph;
}

const sorted = set => [...set].sort((a, b) => a - b);
const overlap = (a, b) => sorted([...a].filter(y => b.has(y)));

function step(graph, kind, id) {
    if (kind === 'person') {
        const p = graph.persons.get(id);
        return { kind, id, name: p.name || '', title: p.title || '', suffix: p.suffix || '' };
    }
    const i = graph.insts.get(id);
    return { kind, id, name: i.name || '', type: i.type || '', place: i.place || '' };
}

/**
 * {found, from, to, steps: [{kind, id, name, …}], links: [{years}]} — links[i]
 * joins steps[i] and steps[i + 1]: the years that person was listed there
 * (alongside the next person, in the middle of a chain).
 */
async function findPath(fromId, toId) {
    const graph = await loadGraph();
    const kindOf = id => graph.persons.has(id) ? 'person' : graph.insts.has(id) ? 'institution' : null;
    const fromKind = kindOf(fromId), toKind = kindOf(toId);
    const result = { found: false, from: fromKind && step(graph, fromKind, fromId), to: toKind && step(graph, toKind, toId), steps: [], links: [] };
    if (!fromKind || !toKind || fromId === toId) return result;

    const isTarget = p => toKind === 'person' ? p === toId : graph.persons.get(p).at.has(toId);
    const start = fromKind === 'person' ? [fromId] : [...new Set([...graph.insts.get(fromId).byYear.values()].flatMap(s => [...s]))];

    // breadth-first over people; each institution-year is opened once
    const prev = new Map(start.map(p => [p, null]));
    const opened = new Set();
    let frontier = start, hit = start.find(isTarget) ?? null;
    for (let depth = 1; !hit && frontier.length && depth < MAX_PEOPLE; depth++) {
        const next = [];
        for (const p of frontier) {
            for (const [inst, years] of graph.persons.get(p).at) {
                for (const y of years) {
                    const slot = inst + '|' + y;
                    if (opened.has(slot)) continue;
                    opened.add(slot);
                    for (const q of graph.insts.get(inst).byYear.get(y)) {
                        if (prev.has(q)) continue;
                        prev.set(q, { from: p, inst });
                        next.push(q);
                        if (!hit && isTarget(q)) hit = q;
                    }
                }
            }
            if (hit) break;
        }
        frontier = next;
    }
    if (!hit) return result;

    // walk back: person, institution, person, …
    const chain = [];
    for (let p = hit; p !== undefined && p !== null; p = prev.get(p)?.from) chain.unshift({ p, inst: prev.get(p)?.inst });
    const { persons } = graph;
    if (fromKind === 'institution') {
        result.steps.push(step(graph, 'institution', fromId));
        result.links.push({ years: sorted(persons.get(chain[0].p).at.get(fromId)) });
    }
    chain.forEach((c, i) => {
        if (i > 0) {
            const shared = overlap(persons.get(chain[i - 1].p).at.get(c.inst), persons.get(c.p).at.get(c.inst));
            result.steps.push(step(graph, 'institution', c.inst));
            result.links.push({ years: shared });
        }
        result.steps.push(step(graph, 'person', c.p));
        if (i < chain.length - 1) result.links.push({ years: overlap(persons.get(c.p).at.get(chain[i + 1].inst), persons.get(chain[i + 1].p).at.get(chain[i + 1].inst)) });
    });
    if (toKind === 'institution') {
        result.steps.push(step(graph, 'institution', toId));
        result.links.push({ years: sorted(persons.get(hit).at.get(toId)) });
    }
    result.found = true;
    return result;
}

module.exports = { findPath, loadGraph, MAX_PEOPLE };
