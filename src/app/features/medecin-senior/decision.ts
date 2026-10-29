/** Donnees passees aux dialogues d'acceptation et de refus. */
export interface DonneesDecision {
  demandeId: string;
  nomPatient: string;
}

/**
 * Valeur de fermeture d'un dialogue de decision (undefined = annule).
 * 'conflit' : le serveur a repondu 409, la demande a ete traitee entre-temps.
 */
export type IssueDecision = { issue: 'decidee'; message: string } | { issue: 'conflit' };

export const MESSAGE_CONFLIT =
  'Cette demande a déjà été traitée par un autre médecin. Son statut vient d’être actualisé.';
