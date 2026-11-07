/**
 * Contrat Fiche 1 du parcours admin : impression combinee (POST /api/visites/impression) et import
 * en lot (POST /api/fiches-signees/import). L'admin ne manipule que des identites et des
 * identifiants, jamais une donnee medicale.
 */

/** Enum TypeVisite du serveur. */
export type TypeVisite = 'INITIALE' | 'ROUTINE';

export const LIBELLES_TYPE_VISITE: Record<TypeVisite, string> = {
  INITIALE: 'Visite initiale',
  ROUTINE: 'Visite de routine',
};

/** Identite seule, extraite de PatientResponse (GET /api/patients) : aucun autre champ n'est garde. */
export interface PatientIdentite {
  id: string;
  nomComplet: string;
  numeroDossierProxymed: string | null;
  dateNaissance: string | null;
}

/** VisiteViergeRequest. */
export interface VisiteViergeRequest {
  patientId: string;
  typeVisite: TypeVisite;
}

/** ImpressionFichesRequest. */
export interface ImpressionFichesRequest {
  fiches: VisiteViergeRequest[];
}

/** ImpressionFichesRequest.MAX_FICHES. */
export const MAX_FICHES_IMPRESSION = 50;

/** En-tete expose par le CORS : ids des visites creees, dans l'ordre des fiches. */
export const EN_TETE_VISITES = 'X-Visites-Ids';

/** Nom de la partie multipart, repetee (@RequestPart("fichiers")). */
export const PARTIE_FICHIERS_LOT = 'fichiers';

/** ImportFichesLotService.MAX_FICHIERS. */
export const MAX_FICHIERS_IMPORT = 20;

export const RESULTAT_IMPORTEE = 'IMPORTEE';
export const RESULTAT_ERREUR = 'ERREUR';

/** ResultatImportResponse (champs nuls omis par le serveur). */
export interface ResultatImportResponse {
  index: number;
  nomFichier: string | null;
  resultat: typeof RESULTAT_IMPORTEE | typeof RESULTAT_ERREUR;
  code: number;
  ficheId?: string;
  consultationId?: string;
  patientId?: string;
  statut?: string;
  reimportee?: boolean;
  erreur?: string;
  message?: string;
}

/** ImportLotResponse : un resultat par fichier, dans l'ordre de l'envoi. */
export interface ImportLotResponse {
  nombreFichiers: number;
  nombreImportees: number;
  nombreErreurs: number;
  resultats: ResultatImportResponse[];
}
