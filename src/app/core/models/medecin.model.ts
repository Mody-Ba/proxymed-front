/**
 * GET /api/auth/medecins-juniors (MEDECIN_SENIOR) : juniors actifs, tries par nom.
 * Le service d'authentification n'expose que ces deux champs.
 */
export interface MedecinJuniorResponse {
  id: string;
  nomComplet: string;
}

/**
 * GET /api/medecins?role=SENIOR (Fiche 1, MEDECIN_JUNIOR ou MEDECIN_SENIOR) : liste simple, non
 * paginee. Ces medecins de la Fiche 1 (identifiant numerique) ne sont pas encore relies aux comptes
 * du service d'authentification.
 */
export interface MedecinFiche1Response {
  id: number;
  nom: string;
  prenom: string;
  numeroOrdre: string;
  role: 'SENIOR' | 'JUNIOR';
  structureRattachementId: number | null;
  structureRattachementLibelle: string | null;
}
