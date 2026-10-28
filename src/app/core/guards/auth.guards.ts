import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Role } from '../models/role.model';
import { AuthService } from '../services/auth.service';

/*
 * Ces gardes servent seulement a l'affichage (ne pas montrer une page inutile).
 * Elles ne protegent aucune donnee : chaque appel est verifie par le serveur, qui
 * repond 401 ou 403 quel que soit l'etat du front.
 */

function verifierAcces(rolesAutorises?: readonly Role[]): true | UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estConnecte()) {
    return router.parseUrl('/connexion');
  }
  if (auth.motDePasseTemporaire()) {
    return router.parseUrl('/changer-mot-de-passe');
  }
  const role = auth.role();
  if (rolesAutorises && (!role || !rolesAutorises.includes(role))) {
    return router.parseUrl('/acces-refuse');
  }
  return true;
}

/** Connecte, avec un mot de passe definitif. */
export const authGuard: CanActivateFn = () => verifierAcces();

/** Connecte, mot de passe definitif et role parmi ceux indiques. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => verifierAcces(roles);
}

/** Connecte, meme avec un mot de passe temporaire (page /changer-mot-de-passe). */
export const connecteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estConnecte() ? true : inject(Router).parseUrl('/connexion');
};

/** Page de connexion : un compte deja connecte est renvoye vers son accueil. */
export const inviteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estConnecte() ? inject(Router).parseUrl(auth.urlAccueil()) : true;
};
