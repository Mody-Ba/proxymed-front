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

export const MESSAGE_DEMANDE_ACCES_REFUSE = 'Vous n’avez pas accès à cette demande.';
export const MESSAGE_DEMANDE_INTROUVABLE = 'Cette demande est introuvable.';

/**
 * Lecture du detail d'une demande. 403 / 404 (et 400 pour un identifiant mal forme) : message
 * clair, sans detail technique.
 */
export function messageChargementDemande(erreur: unknown): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 403) {
      return MESSAGE_DEMANDE_ACCES_REFUSE;
    }
    if (erreur.status === 404 || erreur.status === 400) {
      return MESSAGE_DEMANDE_INTROUVABLE;
    }
  }
  return messageErreur(erreur, 'La demande n’a pas pu être chargée.');
}

/** 409 sur accepter / refuser : la demande n'est plus EN_ATTENTE. */
export function estConflit(erreur: unknown): boolean {
  return erreur instanceof HttpErrorResponse && erreur.status === 409;
}

/** 503 du service d'authentification : l'e-mail (mot de passe temporaire) n'a pas pu partir. */
export function estEchecEnvoiEmail(erreur: unknown): boolean {
  return erreur instanceof HttpErrorResponse && erreur.status === 503;
}

/** Champ "erreur" du corps d'erreur du serveur (ex. pour distinguer deux 409). */
export function typeErreur(erreur: unknown): string | null {
  const type = corpsServeur(erreur)?.erreur;
  return typeof type === 'string' ? type : null;
}
