/**
 * POST /api/fiches-signees/import (repond 201) et GET /api/patients/{patientId}/fiches-signees.
 * Metadonnees uniquement : le contenu du fichier n'est jamais renvoye ici. patientId et
 * consultationId sont lus par le serveur dans le code QR de la fiche.
 */
export interface FicheSigneeResponse {
  id: string;
  patientId: string;
  consultationId: string;
  dateConsultation: string | null;
  nomFichier: string;
  tailleOctets: number;
  dateImport: string;
}

/** Nom de la partie multipart attendue par le serveur (@RequestPart("fichier")). */
export const PARTIE_FICHIER_IMPORT = 'fichier';

/** Identique a spring.servlet.multipart.max-file-size=10MB (10 * 1024 * 1024 octets). */
export const TAILLE_MAX_FICHE_OCTETS = 10 * 1024 * 1024;

/** Type exige par le serveur (type declare + signature %PDF-). */
export const TYPE_PDF = 'application/pdf';

/** Fichier recu du serveur, avec le nom a proposer a l'enregistrement. */
export interface FichierTelecharge {
  contenu: Blob;
  nomFichier: string;
}

/** Valeurs du champ "erreur" de l'import (GlobalExceptionHandler de la Fiche 1). */
export const ERREUR_REQUETE_INVALIDE = 'Requete invalide';
export const ERREUR_REGLE_GESTION = 'Regle de gestion non respectee';
export const ERREUR_ACCES_REFUSE = 'Acces refuse';
export const ERREUR_RESSOURCE_INTROUVABLE = 'Ressource introuvable';
export const ERREUR_FICHE_DEJA_IMPORTEE = 'Fiche signee deja importee';
export const ERREUR_FICHIER_TROP_VOLUMINEUX = 'Fichier trop volumineux';
export const ERREUR_FORMAT_NON_SUPPORTE = 'Format de fichier non supporte';
export const ERREUR_CODE_QR_INTROUVABLE = 'Code QR introuvable';
