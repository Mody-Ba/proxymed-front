import { Routes } from '@angular/router';

/*
 * Toutes ces routes sont sous /patient, deja gardees par roleGuard('UTILISATEUR') dans
 * app.routes.ts. Les titres d'onglet ne contiennent jamais de donnee medicale ; seul
 * l'identifiant de la demande apparait dans l'URL.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Espace patient · PROXYMED',
    loadComponent: () => import('./accueil-patient/accueil-patient').then((m) => m.AccueilPatient),
  },
  {
    path: 'nouvelle-demande',
    title: 'Nouvelle demande · PROXYMED',
    loadComponent: () =>
      import('./nouvelle-demande/nouvelle-demande').then((m) => m.NouvelleDemande),
  },
  {
    path: 'mes-demandes',
    title: 'Mes demandes · PROXYMED',
    loadComponent: () => import('./mes-demandes/mes-demandes').then((m) => m.MesDemandes),
  },
  {
    path: 'demandes/:id',
    title: 'Détail de la demande · PROXYMED',
    loadComponent: () => import('./detail-demande/detail-demande').then((m) => m.DetailDemande),
  },
];
