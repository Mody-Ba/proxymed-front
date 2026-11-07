import {
  FicheAViserResponse,
  MAX_FICHES_DECISION,
  MOTIF_RENVOI_MAX,
  RESULTAT_DECISION_ERREUR,
  ResultatDecisionResponse,
} from '../models/visa-fiche.model';

/*
 * Regles locales du visa par le senior. Elles evitent un envoi voue a l'echec ; le serveur
 * applique les memes limites (50 fiches, motif obligatoire de 1000 caracteres au plus).
 */

export { ajouterASelection, basculerSelection, type ResultatSelection } from './fiches-admin';

export const MESSAGE_SELECTION_FICHES_MAX = `Vous pouvez sélectionner au plus ${MAX_FICHES_DECISION} fiches par action.`;

export const MESSAGE_MOTIF_OBLIGATOIRE = 'Le motif du renvoi est obligatoire.';
export const MESSAGE_MOTIF_TROP_LONG = `Le motif du renvoi ne doit pas dépasser ${MOTIF_RENVOI_MAX} caractères.`;

/** Comme @NotBlank + @Size(max = 1000) du serveur. Null si le motif est valable. */
export function erreurMotifRenvoi(motif: string | null | undefined): string | null {
  const texte = motif ?? '';
  if (!texte.trim()) {
    return MESSAGE_MOTIF_OBLIGATOIRE;
  }
  if (texte.length > MOTIF_RENVOI_MAX) {
    return MESSAGE_MOTIF_TROP_LONG;
  }
  return null;
}

/** Derniere verification de la selection avant un visa ou un renvoi. */
export function erreurSelectionDecision(
  visiteIds: readonly string[],
  max = MAX_FICHES_DECISION,
): string | null {
  if (!visiteIds.length) {
    return 'Sélectionnez au moins une fiche.';
  }
  if (visiteIds.length > max) {
    return MESSAGE_SELECTION_FICHES_MAX;
  }
  return null;
}

export type ActionDecision = 'visa' | 'renvoi';

export type StatutDecision = 'visee' | 'renvoyee' | 'conflit' | 'erreur';

export const LIBELLES_STATUT_DECISION: Record<StatutDecision, string> = {
  visee: 'Visée',
  renvoyee: 'Renvoyée',
  conflit: 'Déjà traitée',
  erreur: 'Erreur',
};

export const MESSAGE_DECISION_VISEE = 'La fiche est visée. Son rapport peut être téléchargé.';
export const MESSAGE_DECISION_RENVOYEE =
  'La fiche est renvoyée avec le motif indiqué : l’administrateur pourra en importer une nouvelle.';
export const MESSAGE_DECISION_CONFLIT =
  'Cette fiche n’est plus en attente : elle a déjà été visée ou renvoyée, peut-être par un autre médecin.';
export const MESSAGE_DECISION_INTROUVABLE = 'Cette fiche est introuvable.';
export const MESSAGE_DECISION_ERREUR_INTERNE =
  'Le traitement de cette fiche a échoué pour une raison imprévue. Réessayez plus tard.';

export function statutDecision(resultat: ResultatDecisionResponse): StatutDecision {
  if (resultat.resultat === 'VISEE') {
    return 'visee';
  }
  if (resultat.resultat === 'RENVOYEE') {
    return 'renvoyee';
  }
  return resultat.code === 409 ? 'conflit' : 'erreur';
}

/** Message d'une ligne du resultat (traduit d'apres le code, jamais le message brut avec ses ids). */
export function messageResultatDecision(resultat: ResultatDecisionResponse): string {
  switch (statutDecision(resultat)) {
    case 'visee':
      return MESSAGE_DECISION_VISEE;
    case 'renvoyee':
      return MESSAGE_DECISION_RENVOYEE;
    case 'conflit':
      return MESSAGE_DECISION_CONFLIT;
  }
  if (resultat.resultat === RESULTAT_DECISION_ERREUR && resultat.code === 404) {
    return MESSAGE_DECISION_INTROUVABLE;
  }
  return MESSAGE_DECISION_ERREUR_INTERNE;
}

export interface LigneDecision {
  index: number;
  visiteId: string;
  patient: string;
  statut: StatutDecision;
  libelleStatut: string;
  message: string;
  /** Rapport telechargeable : fiche visee par cette action. */
  rapport: boolean;
}

export function identitePatient(
  fiche: Pick<FicheAViserResponse, 'nomPatient' | 'numeroDossierProxymed'>,
): string {
  return fiche.numeroDossierProxymed
    ? `${fiche.nomPatient} (${fiche.numeroDossierProxymed})`
    : fiche.nomPatient;
}

/**
 * Lignes du tableau de resultats, dans l'ordre de la reponse. Les fiches connues (selection)
 * donnent l'identite du patient ; une fiche en conflit n'empeche pas les autres.
 */
export function lignesDecision(
  resultats: readonly ResultatDecisionResponse[],
  fiches: ReadonlyMap<string, FicheAViserResponse>,
): LigneDecision[] {
  return resultats.map((resultat) => {
    const statut = statutDecision(resultat);
    const fiche = fiches.get(resultat.visiteId);
    return {
      index: resultat.index,
      visiteId: resultat.visiteId,
      patient: fiche ? identitePatient(fiche) : '—',
      statut,
      libelleStatut: LIBELLES_STATUT_DECISION[statut],
      message: messageResultatDecision(resultat),
      rapport: statut === 'visee',
    };
  });
}

export function resumeDecision(
  action: ActionDecision,
  reponse: { nombreFiches: number; nombreReussies: number; nombreErreurs: number },
): string {
  const { nombreFiches: total, nombreReussies: ok, nombreErreurs: ko } = reponse;
  const verbe = action === 'visa' ? 'visée' : 'renvoyée';
  const fiches = `${total} fiche${total > 1 ? 's' : ''} traitée${total > 1 ? 's' : ''}`;
  return `${fiches} : ${ok} ${verbe}${ok > 1 ? 's' : ''}, ${ko} non traitée${ko > 1 ? 's' : ''}.`;
}
