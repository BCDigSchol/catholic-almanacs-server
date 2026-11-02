// Center and periphery: where each record sat between a center and its
// hinterland, under three readings of what the center is:
//   diocese  the see of the record's own diocese (the Church's own map):
//            rings by straight-line miles from the see
//   metro    the nearest metro area (server/data/metros.csv, a boundary drawn
//            for this site): rings by miles from the city
//   ties     the circuits: a hub whose clergy rode out to stations, a station
//            served from elsewhere, both, or neither (no distance at all)
// The rings: center (≤ 5 mi), near (≤ 25), hinterland (≤ 100), remote.

const { kindOf } = require('./gender');

const BANDS = [5, 25, 100];
const RINGS = [
    { id: 'center', label: 'At the center (within 5 mi)' },
    { id: 'near', label: 'Near (5–25 mi)' },
    { id: 'hinterland', label: 'The hinterland (25–100 mi)' },
    { id: 'remote', label: 'Remote (over 100 mi, or no center)' },
];
const TIES = [
    { id: 'hub', label: 'A hub: its clergy served other places' },
    { id: 'both', label: 'Both a hub and a station' },
    { id: 'station', label: 'A station, served from elsewhere' },
    { id: 'alone', label: 'Neither' },
];
/** What an institution was, in six kinds, for what sits at the center and what at the edge. */
const KINDS = [
    { id: 'parish', label: 'Churches and chapels' },
    { id: 'station', label: 'Stations and missions' },
    { id: 'school', label: 'Schools' },
    { id: 'academy', label: 'Academies and colleges' },
    { id: 'charity', label: 'Asylums and hospitals' },
    { id: 'house', label: 'Religious houses' },
    { id: 'other', label: 'Other' },
];

function kindOfType(type) {
    const t = String(type || '').toLowerCase();
    const k = kindOf(t);
    if (k === 'hospital' || k === 'asylum') return 'charity';
    if (k === 'college' || k === 'academy') return 'academy';
    if (k === 'school' || k === 'house') return k;
    if (/station|mission/.test(t)) return 'station';
    if (/church|cathedral|chapel/.test(t)) return 'parish';
    return 'other';
}

const R = 3958.8;   // miles
function miles(lat1, lng1, lat2, lng2) {
    const toR = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * toR / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin((lng2 - lng1) * toR / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function ringOf(d) {
    if (d == null) return 'remote';
    const i = BANDS.findIndex(b => d <= b);
    return RINGS[i === -1 ? 3 : i].id;
}

/** The nearest of `centers` ([{id, lat, lng}]) to a point: {id, miles}. */
function nearest(lat, lng, centers) {
    let best = null;
    for (const c of centers) {
        const d = miles(lat, lng, c.lat, c.lng);
        if (!best || d < best.miles) best = { id: c.id, miles: d };
    }
    return best;
}

/**
 * Where a record sits: {center: id | null, ring}. `centers` is a Map(id ->
 * {id, lat, lng}) for the diocese reading (looked up by the record's diocese)
 * or an array for the metro reading (the nearest wins).
 */
function place(f, by, centers) {
    if (f.lat == null || f.lng == null) return { center: null, ring: 'remote' };
    if (by === 'diocese') {
        const c = centers.get(f._dio);
        return c ? { center: f._dio, ring: ringOf(miles(f.lat, f.lng, c.lat, c.lng)) } : { center: null, ring: 'remote' };
    }
    const n = nearest(f.lat, f.lng, centers);
    return n ? { center: n.id, ring: ringOf(n.miles) } : { center: null, ring: 'remote' };
}

/** The ring's rank, for whether a move went toward the center (lower) or away. */
const RANK = { center: 0, near: 1, hinterland: 2, remote: 3, hub: 0, both: 1, station: 2, alone: 3 };

module.exports = { BANDS, RINGS, TIES, KINDS, RANK, kindOfType, miles, ringOf, nearest, place };
