/**
 * Seul endroit ou sont ecrites les adresses des services PROXYMED.
 * L'intercepteur n'envoie le badge qu'a ces adresses.
 */
export const environment = {
  production: false,
  api: {
    auth: 'http://localhost:8083',
    fiche1: 'http://localhost:8081',
    fiche2: 'http://localhost:8082',
  },
};
