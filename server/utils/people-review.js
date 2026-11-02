// People to review: person ids that may be one person split in two, and ids
// listed under more than one surname. Built once per process from every
// listing, like loadMoves.
//
// Duplicates: two ids with the same surname whose given names fit (the same,
// or initials that agree: "E. J." and "Elisha J.") are scored on the evidence
// of their careers. For: one picks up the year after the other ends, the same
// post or diocese at the handover, the same religious order. Against: both
// listed at different places in the same year, or different orders. Pairs
// already judged (server/data/person-decisions.csv, exported from the review
// page) carry their decision.

const fs = require('fs');
const path = require('path');
const db = require('../models');
const { orderOfSuffix } = require('./orders');

const DECISIONS_PATH = path.join(__dirname, '..', 'data', 'person-decisions.csv');
const MIN_SCORE = 2.5;            // below this a pair is not worth a reviewer's time
const NOT_GIVEN = new Set(['rev', 'mr', 'fr', 'rt', 'very', 'st', 'mother', 'sister', 'brother', 'father', 'dr']);

let _review = null;

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z\s.'-]/g, ' ').replace(/\s+/g, ' ').trim();
const mostCommon = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

/** Given names fit when each matches in full or by initial; 'exact', 'initials', 'weak' (one has none) or null. */
function givenFit(a, b) {
    if (!a.length || !b.length) return 'weak';
    const n = Math.min(a.length, b.length);
    let exact = a.length === b.length;
    for (let i = 0; i < n; i++) {
        const x = a[i], y = b[i];
        if (x === y) continue;
        if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))) { exact = false; continue; }
        return null;
    }
    return exact ? 'exact' : 'initials';
}

/** "1864–65 St. Mary's (Albany)" runs: a career as consecutive stays. */
function career(p) {
    const stays = [];
    for (const y of p.years) {
        for (const post of p.byYear.get(y)) {
            const open = stays.find(s => s.inst === post.inst && s.to === p.prevYear(y));
            if (open) open.to = y;
            else stays.push({ inst: post.inst, name: post.name, type: post.type, dio: post.dio, from: y, to: y, visiting: post.att });
        }
    }
    return stays.sort((a, b) => a.from - b.from || a.to - b.to);
}

function readDecisions() {
    const out = new Map();
    try {
        const lines = fs.readFileSync(DECISIONS_PATH, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
        const head = lines.shift().split(',').map(h => h.trim());
        const ia = head.indexOf('a'), ib = head.indexOf('b'), id = head.indexOf('decision');
        for (const l of lines) {
            const c = l.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            if (c[ia] && c[ib] && c[id]) out.set([c[ia], c[ib]].sort().join('|'), c[id]);
        }
    } catch { /* no decisions yet */ }
    return out;
}

async function loadReview() {
    if (_review) return _review;
    const rows = await db.sequelize.query(
        `SELECT p.persID, p.name, p.lastName, p.title, p.suffix, p.isAttending,
                a.year, a.instID, a.instName, a.instType, a.diocese
           FROM personInAlmanacRecords p
           JOIN almanacRecords a ON a.ID = p.almanacRecordID
          WHERE p.persID IS NOT NULL AND a.year IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    const allYears = [...new Set(rows.map(r => Number(r.year)))].sort((a, b) => a - b);
    const prevYear = y => allYears[allYears.indexOf(y) - 1];

    const people = new Map();
    for (const r of rows) {
        let p = people.get(r.persID);
        if (!p) people.set(r.persID, p = { id: r.persID, names: new Map(), lasts: new Map(), titles: new Set(), orders: new Set(), byYear: new Map(), prevYear });
        p.names.set(r.name, (p.names.get(r.name) || 0) + 1);
        // a name printed without a surname ("Nazarius", "J. Philip") gives none
        const words = String(r.name || '').trim().split(/\s+/);
        const last = norm(r.lastName || (words.length > 1 ? words[words.length - 1] : '')).replace(/[^a-z]/g, '');
        if (last) p.lasts.set(last, (p.lasts.get(last) || 0) + 1);
        if (r.title) p.titles.add(r.title);
        const order = orderOfSuffix(r.suffix);
        if (order) p.orders.add(order.id);
        const y = Number(r.year);
        if (!p.byYear.has(y)) p.byYear.set(y, []);
        p.byYear.get(y).push({ inst: r.instID, name: r.instName || '', type: r.instType || '', dio: r.diocese || '', att: !!r.isAttending });
    }
    for (const p of people.values()) {
        p.name = mostCommon(p.names);
        p.surname = mostCommon(p.lasts);
        const tokens = norm(p.name).replace(/\./g, ' ').split(' ').filter(Boolean);
        p.given = tokens.slice(0, -1).filter(t => !NOT_GIVEN.has(t));
        p.years = [...p.byYear.keys()].sort((a, b) => a - b);
    }

    // ---- duplicate candidates -------------------------------------------------
    const decisions = readDecisions();
    const bySurname = new Map();
    for (const p of people.values()) {
        if (!p.surname) continue;
        if (!bySurname.has(p.surname)) bySurname.set(p.surname, []);
        bySurname.get(p.surname).push(p);
    }
    const pairs = [];
    for (const group of bySurname.values()) {
        if (group.length < 2 || group.length > 80) continue;   // "Smith": too many namesakes to pair blindly
        for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
            let a = group[i], b = group[j];
            if (a.years[0] > b.years[0]) [a, b] = [b, a];
            const fit = givenFit(a.given, b.given);
            if (!fit) continue;
            const reasons = [];
            let score = fit === 'exact' ? 3 : fit === 'initials' ? 2 : 0.5;
            reasons.push(fit === 'exact' ? 'the same name' : fit === 'initials' ? 'the names fit (initials)' : 'the same surname');

            const shared = a.years.filter(y => b.byYear.has(y));
            const clash = shared.filter(y => {
                const posts = new Set(a.byYear.get(y).map(x => x.inst));
                return !b.byYear.get(y).some(x => posts.has(x.inst));
            });
            if (clash.length) { score -= 4; reasons.push(`both listed, at different places, in ${clash.join(', ')}`); }
            else if (shared.length) { score += 1; reasons.push(`both listed at the same place in ${shared.join(', ')}`); }

            const aLast = a.years[a.years.length - 1], bFirst = b.years[0];
            if (!shared.length) {
                if (aLast === 1838 && bFirst === 1864) { score += 0.5; reasons.push('one ends in 1838, the other begins in 1864'); }
                else if (prevYear(bFirst) === aLast) { score += 2; reasons.push(`one picks up in ${bFirst}, the year after the other ends`); }
                else { score += 1; reasons.push(`one ends in ${aLast}, the other begins in ${bFirst}`); }
                const before = a.byYear.get(aLast), after = b.byYear.get(bFirst);
                if (before.some(x => after.some(z => z.inst === x.inst))) { score += 3; reasons.push('the same post at the handover'); }
                else if (before.some(x => after.some(z => z.dio && z.dio === x.dio))) { score += 1; reasons.push('the same diocese at the handover'); }
            }
            if (a.orders.size && b.orders.size) {
                if ([...a.orders].some(o => b.orders.has(o))) { score += 1; reasons.push('the same religious order'); }
                else { score -= 3; reasons.push('different religious orders'); }
            }
            const key = [a.id, b.id].sort().join('|');
            if (score < MIN_SCORE && !decisions.has(key)) continue;
            pairs.push({
                key, score, reasons,
                strength: score >= 6 ? 'strong' : score >= 4 ? 'likely' : 'possible',
                decision: decisions.get(key) || null,
                a: summary(a), b: summary(b),
            });
        }
    }
    pairs.sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name));

    // ---- one id, several surnames ------------------------------------------------
    const nameConflicts = [];
    for (const p of people.values()) {
        const lasts = [...p.lasts.keys()];
        if (lasts.length < 2) continue;
        // spelling variants ("Mc Closkey"/"McCloskey", "Shields"/"Shield") are not conflicts
        const distinct = lasts.filter((l, i) => !lasts.slice(0, i).some(m => similar(l, m)));
        if (distinct.length < 2) continue;
        nameConflicts.push({
            id: p.id, name: p.name,
            names: [...p.names.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
            years: `${p.years[0]}–${p.years[p.years.length - 1]}`,
        });
    }
    nameConflicts.sort((a, b) => a.name.localeCompare(b.name));

    _review = { pairs, nameConflicts, people: people.size };
    return _review;

    function summary(p) {
        return {
            id: p.id, name: p.name, titles: [...p.titles], orders: [...p.orders],
            years: `${p.years[0]}–${p.years[p.years.length - 1]}`,
            career: career(p).map(s => ({ inst: s.inst, name: s.name, type: s.type, dio: s.dio, from: s.from, to: s.to, visiting: s.visiting })),
        };
    }
}

/**
 * Two surnames that are one spelt two ways: one contains the other, they start
 * alike ("Frauendorfer" / "Frauenhoffer", "Zingsheim" / "Zingchina": the
 * transcriber's reading of a hard name), or they differ in under a third of
 * their letters.
 */
function similar(a, b) {
    if (a.includes(b) || b.includes(a)) return true;
    if (a.length >= 4 && b.length >= 4 && a.slice(0, 3) === b.slice(0, 3)) return true;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length] <= Math.max(2, Math.floor(Math.max(a.length, b.length) / 3));
}

module.exports = { loadReview, DECISIONS_PATH };
