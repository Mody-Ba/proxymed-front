import { Routes } from '@angular/router';

/*
 * Toutes ces routes sont sous /admin, deja gardees par roleGuard('ADMIN') dans app.routes.ts.
 * Les titres d'onglet ne contiennent ni nom ni courriel ; aucune donnee de compte dans l'URL.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Espace administrateur · PROXYMED',
    loadComponent: () => import('./accueil-admin/accueil-admin').then((m) => m.AccueilAdmin),
  },
  {
    path: 'comptes',
    title: 'Comptes · PROXYMED',
    loadComponent: () => import('./comptes/comptes').then((m) => m.Comptes),
  },
  {
    path: 'comptes/nouveau',
    title: 'Créer un médecin · PROXYMED',
    loadComponent: () => import('./nouveau-compte/nouveau-compte').then((m) => m.NouveauCompte),
  },
];
