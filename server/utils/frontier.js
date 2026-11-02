// The frontier: each record against the post offices open in its year, from
// the tile build (tiles/frontier-measures.py → /tiles-data/frontier.json):
//   records  {rec: [miles to the nearest open office | null, the year it
//            opened | null, offices within 25 miles]}
//   years    {year: {offices, unchurched, sample: [[lat, lng, name, state]]}}
// Read once per process; null where the build hasn't run here.

const fs = require('fs');

let _frontier = null;

function loadFrontier() {
    if (_frontier) return _frontier;
    const file = process.env.FRONTIER_MEASURES || '/tiles-data/frontier.json';
    try {
        _frontier = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
    return _frontier;
}

module.exports = { loadFrontier };
