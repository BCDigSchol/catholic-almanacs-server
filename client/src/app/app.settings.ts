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
    // deep enough to tell apart churches a few blocks from each other
    mapTilesMaxZoom: 15
};
