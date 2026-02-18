export const Settings = {
    apiUrl: 'http://localhost:8081/api/',
    exportEnabled: false,
    mapTilesUrl: [{
        name: 'OpenStreetMap',
        url: 'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap.json',
    }, {
        name: 'Map Libre Demo Tiles',
        url: 'https://demotiles.maplibre.org/globe.json',
    }, {
        name: 'CartoDB Voyager',
        url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
    }],
    mapTilesAttribution: '© OpenStreetMap contributors, © CartoDB, © MapLibre',
}
