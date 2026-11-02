// Lifespans and turnover: how institutions came and went, and how long clergy
// stayed at a post, read from consecutive almanac years.
//
// A record missing from one year may only mean its diocese wasn't transcribed
// that year, so every comparison of two years counts only dioceses with
// records in both, and only within a run of consecutive almanacs (1833–38,
// 1864–70): 1838 and 1864 are compared separately, as the bridge across the
// gap.

const FUNCTIONS = ['religious institutions', 'educational institutions', 'charitable institutions'];
const SURVIVAL_YEARS = 5;

/**
 * facts: loadFacts() rows ({i: instID, y, f: function, _dio});
 * residents: [{pers, inst, year, dio}], resident (not visiting) listings.
 * Returns everything the dashboard draws, for one diocese ('' = all) and
 * function ('' = all).
 */
function buildTurnover(facts, residents, { diocese = '', fn = '' } = {}) {
    const years = [...new Set(facts.map(f => f.y))].sort((a, b) => a - b);
    const prev = y => { const i = years.indexOf(y); return i > 0 && y - years[i - 1] === 1 ? years[i - 1] : null; };

    // which dioceses have records in which years: the coverage every comparison respects
    const covered = new Map();
    for (const f of facts) {
        if (!covered.has(f.y)) covered.set(f.y, new Set());
        covered.get(f.y).add(f._dio);
    }
    const bothCovered = (dio, a, b) => covered.get(a)?.has(dio) && covered.get(b)?.has(dio);

    // ---- institutions ------------------------------------------------------------
    const inScope = f => (!diocese || f._dio === diocese) && (!fn || f.f === fn);
    const present = new Map();        // year -> Map(instID -> {dio, fn})
    for (const f of facts) {
        if (!inScope(f)) continue;
        if (!present.has(f.y)) present.set(f.y, new Map());
        present.get(f.y).set(f.i, { dio: f._dio, fn: f.f });
    }
    const flows = [];
    for (const y of years) {
        const p = prev(y);
        if (!p) continue;
        const now = present.get(y) || new Map(), before = present.get(p) || new Map();
        let added = 0, gone = 0, kept = 0;
        for (const [id, x] of now) if (bothCovered(x.dio, p, y)) before.has(id) ? kept++ : added++;
        for (const [id, x] of before) if (bothCovered(x.dio, p, y) && !now.has(id)) gone++;
        flows.push({ year: y, from: p, added, gone, kept });
    }

    // how long new institutions lasted: first listed in year s (with s - 1
    // covered, so it really was new), still listed k years later?
    const firstSeen = new Map();
    for (const y of years) for (const [id, x] of present.get(y) || []) if (!firstSeen.has(id)) firstSeen.set(id, { y, ...x });
    const survival = {};
    for (const group of ['all', ...FUNCTIONS]) {
        const at = Array.from({ length: SURVIVAL_YEARS + 1 }, () => ({ alive: 0, of: 0 }));
        for (const [id, s] of firstSeen) {
            if (group !== 'all' && s.fn !== group) continue;
            const p = prev(s.y);
            if (!p || !covered.get(p)?.has(s.dio)) continue;     // the first year of a run, or not covered before: maybe not new
            for (let k = 0; k <= SURVIVAL_YEARS; k++) {
                const y = s.y + k;
                if (!years.includes(y) || !covered.get(y)?.has(s.dio)) break;
                at[k].of++;
                if (present.get(y)?.has(id)) at[k].alive++;
            }
        }
        survival[group] = at.map((v, k) => ({ k, share: v.of ? v.alive / v.of : null, of: v.of }));
    }

    // the bridge: of the institutions listed in the last 1830s almanac, how many appear again in 1864
    const bridge = (() => {
        const last = years.filter(y => y < 1850).pop(), next = years.find(y => y > 1850);
        if (!last || !next) return null;
        const a = present.get(last) || new Map(), b = present.get(next) || new Map();
        let listed = 0, again = 0;
        for (const [id] of a) { listed++; if (b.has(id)) again++; }
        return { from: last, to: next, listed, again };
    })();

    // ---- clergy --------------------------------------------------------------------
    const res = residents.filter(r => !diocese || r.dio === diocese);
    const at = new Map();             // year -> Map(persID -> Set(instID))
    for (const r of res) {
        if (!at.has(r.year)) at.set(r.year, new Map());
        const m = at.get(r.year);
        if (!m.has(r.pers)) m.set(r.pers, new Set());
        m.get(r.pers).add(r.inst);
    }
    const dioOf = new Map(res.map(r => [`${r.year}|${r.inst}`, r.dio]));
    const clergy = [];
    for (const y of years) {
        const p = prev(y);
        if (!p) continue;
        const now = at.get(y) || new Map(), before = at.get(p) || new Map();
        let stayed = 0, left = 0;
        for (const [pers, posts] of before) {
            for (const inst of posts) {
                if (!bothCovered(dioOf.get(`${p}|${inst}`), p, y)) continue;
                if (now.get(pers)?.has(inst)) stayed++; else left++;
            }
        }
        clergy.push({ year: y, from: p, stayed, left, rate: stayed + left ? left / (stayed + left) : null });
    }

    // completed stays: a priest's unbroken years at one post, seen to begin and end inside a run
    const stays = [];
    for (const [pers, byYear] of [...groupBy(res, r => r.pers)]) {
        const posts = groupBy(byYear, r => r.inst);
        for (const [inst, rows] of posts) {
            const ys = [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
            let start = ys[0];
            for (let i = 1; i <= ys.length; i++) {
                if (i < ys.length && prev(ys[i]) === ys[i - 1]) continue;
                const end = ys[i - 1];
                // seen to begin (the year before is covered and he wasn't there) and to end (likewise after)
                const before = prev(start), after = years.includes(end + 1) ? end + 1 : null;
                const dio = rows[0].dio;
                if (before && after && covered.get(before)?.has(dio) && covered.get(after)?.has(dio)) stays.push(end - start + 1);
                start = ys[i];
            }
        }
    }
    stays.sort((a, b) => a - b);
    // a stay seen to begin and end inside 1864–70 lasts at most five years
    const stayHist = Array.from({ length: 5 }, (_, k) => ({ years: k + 1, n: stays.filter(v => v === k + 1).length }));

    return {
        years, flows, survival, bridge, clergy,
        stays: { completed: stays.length, median: stays.length ? stays[Math.floor(stays.length / 2)] : null,
            mean: stays.length ? stays.reduce((n, v) => n + v, 0) / stays.length : null, histogram: stayHist },
    };
}

function groupBy(rows, key) {
    const m = new Map();
    for (const r of rows) {
        const k = key(r);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
    }
    return m;
}

module.exports = { buildTurnover, FUNCTIONS };
