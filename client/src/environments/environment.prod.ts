// LIVE PROD server. Selected by `ng build` (production is the default config).
export const environment = {
  name: 'prod',
  production: true,
  apiUrl: 'https://praetor.bc.edu/production/api/',
  exportEnabled: false,
  // no tile server deployed yet: maps fall back to Carto's public base maps
  tilesUrl: null as string | null,
};
