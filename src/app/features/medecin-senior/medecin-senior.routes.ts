import { Routes } from '@angular/router';

/*
 * Toutes ces routes sont sous /senior, deja gardees par roleGuard('MEDECIN_SENIOR') dans
 * app.routes.ts. Les titres d'onglet ne contiennent jamais de donnee medicale ; seul
 * l'identifiant de la demande apparait dans l'URL.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Espace médecin senior · PROXYMED',
    loadComponent: () => import('./accueil-senior/accueil-senior').then((m) => m.AccueilSenior),
  },
  {
    path: 'demandes',
    title: 'Demandes de consultation · PROXYMED',
    loadComponent: () => import('./demandes-senior/demandes-senior').then((m) => m.DemandesSenior),
  },
  {
    path: 'demandes/:id',
    title: 'Détail de la demande · PROXYMED',
    loadComponent: () =>
      import('./detail-demande-senior/detail-demande-senior').then((m) => m.DetailDemandeSenior),
  },
];
