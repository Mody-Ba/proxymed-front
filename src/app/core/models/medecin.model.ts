/**
 * GET /api/auth/medecins-juniors (MEDECIN_SENIOR) : juniors actifs, tries par nom.
 * Le service d'authentification n'expose que ces deux champs.
 */
export interface MedecinJuniorResponse {
  id: string;
  nomComplet: string;
}
