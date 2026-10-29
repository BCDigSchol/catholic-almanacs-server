// DEFAULT environment — local development against the Docker container.
// Used by `ng serve` and `ng build --configuration development`.
// The other files in this folder are swapped in at build time via the
// fileReplacements in angular.json (see app.settings.ts for the map).
export const environment = {
  name: 'local',
  production: false,
  apiUrl: 'http://localhost:8090/api/',
  exportEnabled: false,
  // the self-hosted tile server (docker compose up -d tiles; see tiles/README.md)
  tilesUrl: 'http://localhost:8092' as string | null,
};
