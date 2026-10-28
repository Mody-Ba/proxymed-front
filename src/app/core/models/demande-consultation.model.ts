/** Statuts d'une demande, identiques a l'enum StatutDemandeConsultation de la Fiche 1. */
export type StatutDemandeConsultation = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemandeConsultation, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
};

/**
 * POST /api/demandes-consultation (repond 201).
 * Ni demandeur ni statut : le serveur les fixe a partir du badge, et refuse tout champ inconnu.
 */
export interface DemandeConsultationRequest {
  nomPatient: string;
  pourProche: boolean;
  motif: string;
}

export interface DemandeConsultationResponse {
  id: string;
  demandeurId: string;
  nomPatient: string;
  pourProche: boolean;
  motif: string;
  statut: StatutDemandeConsultation;
  medecinSeniorId: string | null;
  juniorId: string | null;
  motifRefus: string | null;
  dateCreation: string;
  dateDecision: string | null;
}

/** Longueurs maximales, identiques aux @Size de DemandeConsultationRequest. */
export const NOM_PATIENT_MAX = 200;
export const MOTIF_MAX = 2000;
