import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { messageErreur } from '../utils/erreur-http';

/** Origines des 3 services PROXYMED : les seules a recevoir le badge. */
const ORIGINES_PROXYMED = new Set(
  Object.values(environment.api).map((adresse) => new URL(adresse).origin),
);

/**
 * Appels publics : aucune session en jeu, la page affiche le message du serveur.
 * Sur la connexion, 401 = identifiants faux et 403 = compte inactif ; un 401/403 de
 * l'inscription ne doit pas non plus deconnecter ni renvoyer vers /acces-refuse.
 */
const URLS_PUBLIQUES = new Set(
  ['connexion', 'inscription', 'verification', 'renvoyer-code'].map(
    (chemin) => `${environment.api.auth}/api/auth/${chemin}`,
  ),
);

const MESSAGE_SESSION_INVALIDE = 'Votre session n’est plus valide. Veuillez vous reconnecter.';

/**
 * Comparaison par origine exacte (protocole, hote, port) : "http://localhost:8083.exemple.com"
 * ou "http://localhost:80830" ne recoivent jamais le badge.
 */
function estUnServiceProxymed(url: string): boolean {
  try {
    return ORIGINES_PROXYMED.has(new URL(url, window.location.origin).origin);
  } catch {
    return false;
  }
}

export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  if (!estUnServiceProxymed(requete.url)) {
    return suivant(requete);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const badge = auth.badge();
  const requeteAvecBadge = badge
    ? requete.clone({ setHeaders: { Authorization: `Bearer ${badge}` } })
    : requete;

  return suivant(requeteAvecBadge).pipe(
    catchError((erreur: unknown) => {
      if (erreur instanceof HttpErrorResponse && !URLS_PUBLIQUES.has(requete.url)) {
        if (erreur.status === 401) {
          auth.deconnexion(messageErreur(erreur, MESSAGE_SESSION_INVALIDE));
        } else if (erreur.status === 403) {
          void router.navigateByUrl('/acces-refuse');
        }
      }
      return throwError(() => erreur);
    }),
  );
};
