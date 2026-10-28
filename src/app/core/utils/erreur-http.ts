import { HttpErrorResponse } from '@angular/common/http';
import { ErrorResponse } from '../models/erreur.model';

const MESSAGE_INJOIGNABLE = 'Le service est injoignable. Vérifiez votre connexion puis réessayez.';
const MESSAGE_INATTENDU = 'Une erreur inattendue est survenue.';

function corpsServeur(erreur: unknown): Partial<ErrorResponse> | null {
  if (!(erreur instanceof HttpErrorResponse)) {
    return null;
  }
  const corps = erreur.error;
  return corps && typeof corps === 'object' ? (corps as Partial<ErrorResponse>) : null;
}

/**
 * Message a afficher a l'utilisateur : le champ "message" du serveur, jamais une trace technique.
 */
export function messageErreur(erreur: unknown, parDefaut = MESSAGE_INATTENDU): string {
  if (erreur instanceof HttpErrorResponse && erreur.status === 0) {
    return MESSAGE_INJOIGNABLE;
  }
  const message = corpsServeur(erreur)?.message;
  return typeof message === 'string' && message.trim() ? message : parDefaut;
}

/** Detail des champs refuses par la validation du serveur ("champ : message"). */
export function detailsErreur(erreur: unknown): string[] {
  const details = corpsServeur(erreur)?.details;
  return Array.isArray(details) ? details.filter((d): d is string => typeof d === 'string') : [];
}
