import { TypeVisite } from './fiches-admin.model';

/**
 * Contrat Fiche 1 du visa par le senior (VisaFicheSigneeController) : liste par statut, visa et
 * renvoi en lot, rapport PDF. Le scan se lit par GET /api/consultations/{visiteId}/fiche-signee.
 */

/** Enum StatutFicheSignee du serveur. */
export type StatutFicheSignee = 'EN_ATTENTE' | 'VISEE' | 'RENVOYEE';

/** FicheAViserResponse (champs nuls omis par le serveur). */
export interface FicheAViserResponse {
  ficheId: string;
  visiteId: string;
  patientId: string;
  nomPatient: string;
  numeroDossierProxymed?: string;
  typeVisite?: TypeVisite;
  dateConsultation?: string;
  dateImport: string;
  statut: StatutFicheSignee;
  nomSeniorVisa?: string;
  dateVisa?: string;
  motifRenvoi?: string;
}

/** VisaLotRequest. */
export interface VisaLotRequest {
  visiteIds: string[];
}

/** RenvoiLotRequest. */
export interface RenvoiLotRequest {
  visiteIds: string[];
  motif: string;
}

/** VisaFichesLotService.MAX_FICHES. */
export const MAX_FICHES_DECISION = 50;

/** VisaFichesLotService.MOTIF_MAX. */
export const MOTIF_RENVOI_MAX = 1000;

/** Taille de page par defaut du serveur (VisaFicheSigneeController), maximum 100. */
export const TAILLE_PAGE_FICHES = 20;

export const RESULTAT_DECISION_ERREUR = 'ERREUR';

/** ResultatDecisionResponse : resultat VISEE / RENVOYEE (code 200) ou ERREUR (404, 409, 500). */
export interface ResultatDecisionResponse {
  index: number;
  visiteId: string;
  resultat: 'VISEE' | 'RENVOYEE' | typeof RESULTAT_DECISION_ERREUR;
  code: number;
  statut?: StatutFicheSignee;
  erreur?: string;
  message?: string;
}

/** DecisionLotResponse : un resultat par fiche, dans l'ordre de la requete. */
export interface DecisionLotResponse {
  nombreFiches: number;
  nombreReussies: number;
  nombreErreurs: number;
  resultats: ResultatDecisionResponse[];
}
