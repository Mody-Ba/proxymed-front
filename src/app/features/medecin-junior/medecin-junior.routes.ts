import { Routes } from '@angular/router';

/*
 * Toutes ces routes sont sous /junior, deja gardees par roleGuard('MEDECIN_JUNIOR') dans
 * app.routes.ts. Les titres d'onglet ne contiennent jamais de donnee medicale ; seul
 * l'identifiant de la demande apparait dans l'URL.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Espace médecin junior · PROXYMED',
    loadComponent: () => import('./accueil-junior/accueil-junior').then((m) => m.AccueilJunior),
  },
  {
    path: 'demandes',
    title: 'Demandes assignées · PROXYMED',
    loadComponent: () => import('./demandes-junior/demandes-junior').then((m) => m.DemandesJunior),
  },
  {
    path: 'demandes/:id',
    title: 'Détail de la demande · PROXYMED',
    loadComponent: () =>
      import('./detail-demande-junior/detail-demande-junior').then((m) => m.DetailDemandeJunior),
  },
];
