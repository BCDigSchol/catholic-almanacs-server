import { environment } from '../environments/environment';

// Per-environment config (which API to hit, feature flags) lives in
// src/environments/*. The active file is swapped at BUILD time by the
// fileReplacements in angular.json — never edit the URL here:
//   ng serve  /  ng build --configuration development  -> environment.ts      (local Docker, :8090)
//   ng build --configuration dev                       -> environment.dev.ts  (live dev)
//   ng build  (production is the default)              -> environment.prod.ts (live prod)
export const Settings = {
    apiUrl: environment.apiUrl,
    exportEnabled: environment.exportEnabled,
    // Base-map styles, one per site theme: the self-hosted tile server
    // (tiles/) where the environment has one, else Carto's public base maps.
    mapStyles: environment.tilesUrl ? {
        light: `${environment.tilesUrl}/style/almanac-light`,
        dark: `${environment.tilesUrl}/style/almanac-dark`,
    } : {
        light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    },
    // Fonts for text the maps draw themselves (labels on circuits, careers):
    // ones the base style can serve, i.e. our tile server's Old Standard TT,
    // else what Carto's glyph server carries.
    mapFonts: environment.tilesUrl ? {
        regular: ['Old Standard TT Regular'],
        italic: ['Old Standard TT Italic'],
    } : {
        regular: ['Open Sans Regular'],
        italic: ['Open Sans Italic'],
    },
    // deep enough to tell apart churches a few blocks from each other
    mapTilesMaxZoom: 15,
    // The lower 48, where every recorded place is: the maps keep their centre
    // inside it and zoom out no further than fits it. [[west, south], [east,
    // north]]. Widen west and north when Alaska's records arrive.
    mapBounds: [[-125, 24], [-66, 50]] as [[number, number], [number, number]],
    // How far the view may reach: the extent of the relief (tiles-build
    // terrain, TERRAIN_BOX), so the edge of the elevation never shows. The
    // whole view stays inside it wherever the view is smaller than it; a view
    // taller or wider than it (a phone at country zoom) is centred on it.
    mapViewBounds: [[-131, 17], [-60, 55]] as [[number, number], [number, number]],
};
