// Records against diocese territories: for every almanac record with a place,
// the diocese it was listed under that year (dioceses.dioceseIdAsListed) and
// the diocese whose territory, as drawn for that year, it lies in. The
// territories come from the tile build (tiles/build-dioceses.sh), which places
// every record and writes diocese-territories.json into the tiles volume.
// Built once per process, like loadFacts; restart after rebuilding the tiles.

const fs = require('fs');
const db = require('../models');
const dioceses = require('./dioceses');

let _check = null;

function loadTerritories() {
    const file = process.env.DIOCESE_TERRITORIES || '/tiles-data/diocese-territories.json';
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8')).records;
    } catch {
        return null;   // not built here
    }
}

/** The diocese's name in that year, else its display name. */
function dioceseName(id, year) {
    const d = dioceses.meta(id);
    return (d && (d.namesByYear[year] || d.displayName)) || id;
}

/** [{rec, inst, name, type, place, year, lat, lng, listed, territory}] — territory null if outside every drawn one; null if not built. */
async function loadCheck() {
    if (_check) return _check;
    const territories = loadTerritories();
    if (!territories) return null;
    const rows = await db.sequelize.query(
        `SELECT ID, instID, instName, instType, year, diocese, cityReg, stateReg, latitude, longitude
           FROM almanacRecords
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND year IS NOT NULL`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    _check = rows.map(r => ({
        rec: r.ID,
        inst: r.instID,
        name: r.instName || '',
        type: r.instType || '',
        place: [r.cityReg, r.stateReg].filter(Boolean).join(', '),
        year: Number(r.year),
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        listed: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
        territory: territories[r.ID] || null,
    }));
    return _check;
}

module.exports = { loadCheck, dioceseName };
