import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, connecteGuard, inviteGuard, roleGuard } from './core/guards/auth.guards';
import { AuthService } from './core/services/auth.service';

/*
 * Les gardes ne font que choisir la page affichee : le serveur verifie le badge et le role
 * a chaque appel, c'est lui seul qui protege les donnees.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => inject(AuthService).urlAccueil(),
  },
  {
    path: 'connexion',
    title: 'Connexion · PROXYMED',
    canActivate: [inviteGuard],
    loadComponent: () => import('./features/auth/connexion/connexion').then((m) => m.Connexion),
  },
  {
    path: 'changer-mot-de-passe',
    title: 'Changer le mot de passe · PROXYMED',
    canActivate: [connecteGuard],
    loadComponent: () =>
      import('./features/auth/changer-mot-de-passe/changer-mot-de-passe').then(
        (m) => m.ChangerMotDePasse,
      ),
  },
  {
    path: 'acces-refuse',
    title: 'Accès refusé · PROXYMED',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/erreurs/acces-refuse/acces-refuse').then((m) => m.AccesRefuse),
  },
  {
    path: 'patient',
    canActivate: [roleGuard('UTILISATEUR')],
    loadChildren: () => import('./features/patient/patient.routes').then((m) => m.routes),
  },
  {
    path: 'senior',
    canActivate: [roleGuard('MEDECIN_SENIOR')],
    loadChildren: () =>
      import('./features/medecin-senior/medecin-senior.routes').then((m) => m.routes),
  },
  {
    path: 'junior',
    canActivate: [roleGuard('MEDECIN_JUNIOR')],
    loadChildren: () =>
      import('./features/medecin-junior/medecin-junior.routes').then((m) => m.routes),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.routes),
  },
  { path: '**', redirectTo: '' },
];
