// Metro areas: each city of 50,000 or more at the 1870 census and the counties
// around it (server/data/metros.csv, which says how they were drawn). The
// boundaries are ours, not the period's: the census defined no metropolitan
// areas before 1910, and the metro pages say so. A record is in a metro when
// the county it lay in that year (utils/places.js) is one of the metro's.
// Built once per process; rebuild the API after editing the CSV.

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./links');
const { countyKey } = require('./places');

const METROS_PATH = path.join(__dirname, '..', 'data', 'metros.csv');
const YEARS = [1830, 1840, 1850, 1860, 1870];

let _metros = null;

/** {list: [{id, name, state, lat, lng, also, counties, populations: {year: n}}], byId, byCounty: Map(countyId -> metro)} */
function loadMetros() {
    if (_metros) return _metros;
    const list = [];
    try {
        const [head, ...rows] = parseCsv(fs.readFileSync(METROS_PATH, 'utf8'));
        const col = name => head.indexOf(name);
        for (const r of rows) {
            const get = n => (r[col(n)] ?? '').trim();
            if (!get('id')) continue;
            list.push({
                id: get('id'), name: get('name'), state: get('state'),
                lat: Number(get('lat')), lng: Number(get('lng')),
                also: get('also').split(';').map(s => s.trim()).filter(Boolean),
                counties: get('counties').split(';').map(s => s.trim()).filter(Boolean),
                populations: Object.fromEntries(YEARS.map(y => [y, get(`pop${y}`) ? Number(get(`pop${y}`)) : null])),
            });
        }
    } catch { /* no metros file: no metro pages */ }
    const byCounty = new Map();
    for (const m of list) for (const c of m.counties) byCounty.set(c, m);
    _metros = { list, byId: new Map(list.map(m => [m.id, m])), byCounty };
    return _metros;
}

/** Metros whose city (or a city counted with it) starts with the query: "Bost", "Greater Boston", "Brooklyn". */
function findMetros(query, limit = 5) {
    const want = countyKey(String(query || '').replace(/^greater\s+/i, '').replace(/\s+(metro|area|metro area)$/i, ''));
    if (want.length < 3) return [];
    return loadMetros().list
        .filter(m => [m.name, ...m.also].some(n => countyKey(n).startsWith(want)))
        .slice(0, limit)
        .map(m => ({ type: 'metro', metroID: m.id, name: m.name, state: m.state, also: m.also }));
}

module.exports = { loadMetros, findMetros };
