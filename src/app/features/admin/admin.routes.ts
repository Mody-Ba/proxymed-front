import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Espace administrateur · PROXYMED',
    loadComponent: () =>
      import('../../shared/components/accueil-provisoire/accueil-provisoire').then(
        (m) => m.AccueilProvisoire,
      ),
    data: { titre: 'Espace administrateur' },
  },
];
