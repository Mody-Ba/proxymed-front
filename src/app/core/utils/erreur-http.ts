import { HttpErrorResponse } from '@angular/common/http';
import { ErrorResponse } from '../models/erreur.model';
import {
  ERREUR_ACCES_REFUSE,
  ERREUR_CODE_QR_INTROUVABLE,
  ERREUR_FICHE_DEJA_IMPORTEE,
  ERREUR_FICHIER_TROP_VOLUMINEUX,
  ERREUR_FORMAT_NON_SUPPORTE,
  ERREUR_REGLE_GESTION,
  ERREUR_REQUETE_INVALIDE,
  ERREUR_RESSOURCE_INTROUVABLE,
} from '../models/fiche-signee.model';

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

export const MESSAGE_FICHE_NON_ASSIGNEE = 'Cette consultation ne vous est pas assignée.';
export const MESSAGE_IMPORT_FICHIER_ABSENT =
  'Aucun fichier n’a été reçu par le serveur. Choisissez la fiche PDF puis réessayez.';
export const MESSAGE_IMPORT_FICHE_ILLISIBLE =
  'La fiche n’a pas pu être rangée : le PDF est illisible ou son code QR ne correspond pas à une Fiche 1 PROXYMED de ce patient.';
export const MESSAGE_IMPORT_INTROUVABLE =
  'Le patient ou la consultation indiqués par le code QR sont introuvables.';
export const MESSAGE_IMPORT_DEJA_IMPORTEE =
  'Une fiche signée a déjà été importée pour cette consultation.';
export const MESSAGE_IMPORT_TROP_VOLUMINEUX =
  'Le fichier dépasse la taille maximale de 10 Mo. Scannez la fiche avec une résolution plus faible puis réessayez.';
export const MESSAGE_IMPORT_NON_PDF = 'Le fichier doit être un PDF.';
export const MESSAGE_IMPORT_QR_INTROUVABLE =
  'Aucun code QR n’a été trouvé dans le PDF. Vérifiez que la page portant le code QR est scannée en entier, bien cadrée et nette, puis réessayez.';
export const MESSAGE_IMPORT_INTERROMPU =
  'L’envoi a été interrompu. Vérifiez votre connexion et que le fichier ne dépasse pas 10 Mo, puis réessayez.';
export const MESSAGE_FICHE_PDF_INTROUVABLE = 'Cette consultation est introuvable.';
export const MESSAGE_FICHE_SIGNEE_INTROUVABLE =
  'Aucune fiche signée n’a été importée pour cette consultation.';

/** Correspondance champ "erreur" -> message, pour l'import de la fiche remplie. */
const MESSAGES_IMPORT_PAR_TYPE: Record<string, string> = {
  [ERREUR_REQUETE_INVALIDE]: MESSAGE_IMPORT_FICHIER_ABSENT,
  [ERREUR_REGLE_GESTION]: MESSAGE_IMPORT_FICHE_ILLISIBLE,
  [ERREUR_ACCES_REFUSE]: MESSAGE_FICHE_NON_ASSIGNEE,
  [ERREUR_RESSOURCE_INTROUVABLE]: MESSAGE_IMPORT_INTROUVABLE,
  [ERREUR_FICHE_DEJA_IMPORTEE]: MESSAGE_IMPORT_DEJA_IMPORTEE,
  [ERREUR_FICHIER_TROP_VOLUMINEUX]: MESSAGE_IMPORT_TROP_VOLUMINEUX,
  [ERREUR_FORMAT_NON_SUPPORTE]: MESSAGE_IMPORT_NON_PDF,
  [ERREUR_CODE_QR_INTROUVABLE]: MESSAGE_IMPORT_QR_INTROUVABLE,
};

/** Repli sur le code HTTP quand le corps est absent ou illisible (ex. 413 coupe par le serveur). */
const MESSAGES_IMPORT_PAR_STATUT: Record<number, string> = {
  400: MESSAGE_IMPORT_FICHE_ILLISIBLE,
  403: MESSAGE_FICHE_NON_ASSIGNEE,
  404: MESSAGE_IMPORT_INTROUVABLE,
  409: MESSAGE_IMPORT_DEJA_IMPORTEE,
  413: MESSAGE_IMPORT_TROP_VOLUMINEUX,
  415: MESSAGE_IMPORT_NON_PDF,
  422: MESSAGE_IMPORT_QR_INTROUVABLE,
};

/**
 * Import de la fiche remplie : le champ "erreur" distingue les cas (deux 400 differents), le
 * code HTTP sert de repli. Jamais le message brut du serveur (il contient des identifiants).
 */
export function messageImportFiche(erreur: unknown): string {
  if (!(erreur instanceof HttpErrorResponse)) {
    return MESSAGE_INATTENDU;
  }
  if (erreur.status === 0) {
    return MESSAGE_IMPORT_INTERROMPU;
  }
  const type = typeErreur(erreur);
  return (
    (type ? MESSAGES_IMPORT_PAR_TYPE[type] : undefined) ??
    MESSAGES_IMPORT_PAR_STATUT[erreur.status] ??
    MESSAGE_INATTENDU
  );
}

/** Erreurs d'un telechargement PDF : le corps est un Blob, seul le code HTTP est lu. */
export function messageTelechargementFiche(erreur: unknown, ficheSignee: boolean): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 0) {
      return MESSAGE_INJOIGNABLE;
    }
    if (erreur.status === 403) {
      return MESSAGE_FICHE_NON_ASSIGNEE;
    }
    if (erreur.status === 404 || erreur.status === 400) {
      return ficheSignee ? MESSAGE_FICHE_SIGNEE_INTROUVABLE : MESSAGE_FICHE_PDF_INTROUVABLE;
    }
  }
  return ficheSignee
    ? 'La fiche signée n’a pas pu être téléchargée. Réessayez.'
    : 'La fiche n’a pas pu être téléchargée. Réessayez.';
}

/** 404 : etat normal (rien d'importe, ou consultation sans fiche), jamais affiche en erreur. */
export function estIntrouvable(erreur: unknown): boolean {
  return erreur instanceof HttpErrorResponse && erreur.status === 404;
}
