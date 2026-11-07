import {
  FicheAViserResponse,
  MAX_FICHES_DECISION,
  MOTIF_RENVOI_MAX,
  ResultatDecisionResponse,
} from '../models/visa-fiche.model';
import {
  ajouterASelection,
  basculerSelection,
  erreurMotifRenvoi,
  erreurSelectionDecision,
  lignesDecision,
  MESSAGE_DECISION_CONFLIT,
  MESSAGE_DECISION_INTROUVABLE,
  MESSAGE_DECISION_RENVOYEE,
  MESSAGE_DECISION_VISEE,
  MESSAGE_MOTIF_OBLIGATOIRE,
  MESSAGE_MOTIF_TROP_LONG,
  MESSAGE_SELECTION_FICHES_MAX,
  resumeDecision,
} from './visa-fiches';

function ids(n: number, prefixe = 'v'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefixe}-${i}`);
}

function fiche(visiteId: string, nomPatient: string, numero?: string): FicheAViserResponse {
  return {
    ficheId: `f-${visiteId}`,
    visiteId,
    patientId: `p-${visiteId}`,
    nomPatient,
    numeroDossierProxymed: numero,
    typeVisite: 'INITIALE',
    dateImport: '2026-11-01T10:00:00Z',
    statut: 'EN_ATTENTE',
  };
}

describe('Selection des fiches a viser (max 50 par action)', () => {
  it('la limite est celle du serveur', () => {
    expect(MAX_FICHES_DECISION).toBe(50);
  });

  it('accepte la 50e fiche et refuse la 51e', () => {
    const cinquante = basculerSelection(new Set(ids(49)), 'v-49', MAX_FICHES_DECISION);
    expect(cinquante.selection.size).toBe(50);

    const refusee = basculerSelection(cinquante.selection, 'v-50', MAX_FICHES_DECISION);
    expect(refusee.selection.size).toBe(50);
    expect(refusee.selection.has('v-50')).toBe(false);
    expect(refusee.ignores).toBe(1);
  });

  it('"tout selectionner" sur la page s’arrete a 50', () => {
    const r = ajouterASelection(new Set(ids(40)), ids(20, 'w'), MAX_FICHES_DECISION);
    expect(r.selection.size).toBe(50);
    expect(r.ignores).toBe(10);
  });

  it('verifie la selection avant l’action', () => {
    expect(erreurSelectionDecision([])).toBe('Sélectionnez au moins une fiche.');
    expect(erreurSelectionDecision(ids(51))).toBe(MESSAGE_SELECTION_FICHES_MAX);
    expect(erreurSelectionDecision(ids(50))).toBeNull();
  });
});

describe('Motif du renvoi (obligatoire, 1000 caracteres)', () => {
  it('la limite est celle du serveur', () => {
    expect(MOTIF_RENVOI_MAX).toBe(1000);
  });

  it.each([null, undefined, '', '   ', '\n\t '])('refuse un motif vide (%j)', (motif) => {
    expect(erreurMotifRenvoi(motif)).toBe(MESSAGE_MOTIF_OBLIGATOIRE);
  });

  it('accepte 1000 caracteres et refuse 1001', () => {
    expect(erreurMotifRenvoi('a'.repeat(1000))).toBeNull();
    expect(erreurMotifRenvoi('a'.repeat(1001))).toBe(MESSAGE_MOTIF_TROP_LONG);
  });
});

describe('Resultats mixtes du visa ou du renvoi', () => {
  const fiches = new Map([
    ['v-1', fiche('v-1', 'Awa Diop', 'PX-001')],
    ['v-2', fiche('v-2', 'Moussa Sow')],
    ['v-3', fiche('v-3', 'Fatou Ba', 'PX-003')],
  ]);

  const resultats: ResultatDecisionResponse[] = [
    { index: 0, visiteId: 'v-1', resultat: 'VISEE', code: 200, statut: 'VISEE' },
    {
      index: 1,
      visiteId: 'v-2',
      resultat: 'ERREUR',
      code: 409,
      erreur: 'Action incompatible avec le statut de la fiche',
      message: 'La fiche de la visite v-2 n est pas EN_ATTENTE',
    },
    { index: 2, visiteId: 'v-3', resultat: 'VISEE', code: 200, statut: 'VISEE' },
    { index: 3, visiteId: 'v-9', resultat: 'ERREUR', code: 404, erreur: 'Ressource introuvable' },
  ];

  it('une fiche en 409 ne bloque pas les autres : chaque ligne a son statut et son message', () => {
    const lignes = lignesDecision(resultats, fiches);

    expect(lignes.map((l) => [l.patient, l.statut, l.rapport])).toEqual([
      ['Awa Diop (PX-001)', 'visee', true],
      ['Moussa Sow', 'conflit', false],
      ['Fatou Ba (PX-003)', 'visee', true],
      ['—', 'erreur', false],
    ]);
    expect(lignes[0].message).toBe(MESSAGE_DECISION_VISEE);
    expect(lignes[1].message).toBe(MESSAGE_DECISION_CONFLIT);
    expect(lignes[1].libelleStatut).toBe('Déjà traitée');
    expect(lignes[3].message).toBe(MESSAGE_DECISION_INTROUVABLE);
    // Jamais le message brut du serveur (il contient des identifiants).
    expect(lignes.some((l) => l.message.includes('v-2'))).toBe(false);
  });

  it('un renvoi reussi n’offre pas de rapport', () => {
    const [ligne] = lignesDecision(
      [{ index: 0, visiteId: 'v-1', resultat: 'RENVOYEE', code: 200, statut: 'RENVOYEE' }],
      fiches,
    );
    expect(ligne.statut).toBe('renvoyee');
    expect(ligne.message).toBe(MESSAGE_DECISION_RENVOYEE);
    expect(ligne.rapport).toBe(false);
  });

  it('resume le lot', () => {
    expect(resumeDecision('visa', { nombreFiches: 4, nombreReussies: 2, nombreErreurs: 2 })).toBe(
      '4 fiches traitées : 2 visées, 2 non traitées.',
    );
    expect(resumeDecision('renvoi', { nombreFiches: 1, nombreReussies: 1, nombreErreurs: 0 })).toBe(
      '1 fiche traitée : 1 renvoyée, 0 non traitée.',
    );
  });
});
