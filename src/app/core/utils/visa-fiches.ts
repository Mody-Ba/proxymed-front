import {
  FicheAViserResponse,
  FREQUENCES_VISITES,
  FrequenceVisites,
  LIBELLE_FREQUENCE_NON_PRECISEE,
  LIBELLES_FREQUENCE_VISITES,
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

export type StatutDecision = 'visee' | 'renvoyee' | 'conflit' | 'refusee' | 'erreur';

export const LIBELLES_STATUT_DECISION: Record<StatutDecision, string> = {
  visee: 'Visée',
  renvoyee: 'Renvoyée',
  conflit: 'Déjà traitée',
  refusee: 'Refusée',
  erreur: 'Erreur',
};

export const MESSAGE_DECISION_VISEE = 'La fiche est visée. Son rapport peut être téléchargé.';
export const MESSAGE_DECISION_RENVOYEE =
  'La fiche est renvoyée avec le motif indiqué : l’administrateur pourra en importer une nouvelle.';
export const MESSAGE_DECISION_CONFLIT =
  'Cette fiche n’est plus en attente : elle a déjà été visée ou renvoyée, peut-être par un autre médecin.';
export const MESSAGE_DECISION_INTROUVABLE = 'Cette fiche est introuvable.';
/** Repli si le serveur ne donne pas de message pour une fiche refusee (400). */
export const MESSAGE_DECISION_FREQUENCE_REFUSEE =
  'La fréquence des visites ne se décide qu’au visa d’une visite initiale : cette fiche n’a pas été visée.';
export const MESSAGE_DECISION_ERREUR_INTERNE =
  'Le traitement de cette fiche a échoué pour une raison imprévue. Réessayez plus tard.';

export function statutDecision(resultat: ResultatDecisionResponse): StatutDecision {
  if (resultat.resultat === 'VISEE') {
    return 'visee';
  }
  if (resultat.resultat === 'RENVOYEE') {
    return 'renvoyee';
  }
  if (resultat.code === 409) {
    return 'conflit';
  }
  // 400 par fiche : frequence des visites envoyee pour une visite de ROUTINE.
  return resultat.code === 400 ? 'refusee' : 'erreur';
}

/**
 * Message d'une ligne du resultat, traduit d'apres le code. Seule exception : la fiche refusee (400)
 * affiche le message du serveur, qui explique la regle.
 */
export function messageResultatDecision(resultat: ResultatDecisionResponse): string {
  switch (statutDecision(resultat)) {
    case 'visee':
      return MESSAGE_DECISION_VISEE;
    case 'renvoyee':
      return MESSAGE_DECISION_RENVOYEE;
    case 'conflit':
      return MESSAGE_DECISION_CONFLIT;
    case 'refusee':
      return resultat.message?.trim() || MESSAGE_DECISION_FREQUENCE_REFUSEE;
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

/** Libelle de la frequence des visites, ou « Non précisée ». */
export function libelleFrequenceVisites(frequence: FrequenceVisites | null | undefined): string {
  return frequence ? LIBELLES_FREQUENCE_VISITES[frequence] : LIBELLE_FREQUENCE_NON_PRECISEE;
}

/** Valeur lue dans le menu deroulant : "" (Non précisée) ou une valeur inconnue donnent null. */
export function frequenceDepuisSaisie(valeur: string | null | undefined): FrequenceVisites | null {
  return FREQUENCES_VISITES.find((f) => f === valeur) ?? null;
}

export const LIBELLE_RECAP_SANS_FREQUENCE = 'Sans fréquence (visite de routine)';

export interface FicheRecapFrequence {
  typeVisite?: FicheAViserResponse['typeVisite'];
  frequenceVisites?: FrequenceVisites;
}

/**
 * Recapitulatif des frequences pour la confirmation du visa : nombre de visites initiales par
 * frequence choisie (ou non precisee), puis les fiches sans menu (routine). Lignes a 0 omises.
 */
export function recapitulatifFrequences(fiches: readonly FicheRecapFrequence[]): string[] {
  const initiales = fiches.filter((f) => f.typeVisite === 'INITIALE');
  const lignes: [string, number][] = [...FREQUENCES_VISITES, null].map((frequence) => [
    libelleFrequenceVisites(frequence),
    initiales.filter((f) => (f.frequenceVisites ?? null) === frequence).length,
  ]);
  lignes.push([LIBELLE_RECAP_SANS_FREQUENCE, fiches.length - initiales.length]);
  return lignes
    .filter(([, nombre]) => nombre > 0)
    .map(([libelle, nombre]) => `${libelle} : ${nombre} fiche${nombre > 1 ? 's' : ''}`);
}
