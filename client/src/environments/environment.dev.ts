// LIVE DEV server. Selected by `ng build --configuration dev`.
export const environment = {
  name: 'dev',
  production: false,
  apiUrl: 'https://praetor.bc.edu/development/api/',
  exportEnabled: false,
  // no tile server deployed yet: maps fall back to Carto's public base maps
  tilesUrl: null as string | null,
};
