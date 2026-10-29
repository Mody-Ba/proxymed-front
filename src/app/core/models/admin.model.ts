import { Role } from './role.model';

/** Seuls roles qu'un ADMIN peut creer (ROLES_CREABLES du service d'authentification). */
export type RoleCreable = Extract<Role, 'MEDECIN_JUNIOR' | 'MEDECIN_SENIOR'>;
export const ROLES_CREABLES: readonly RoleCreable[] = ['MEDECIN_JUNIOR', 'MEDECIN_SENIOR'];

/**
 * POST /api/admin/utilisateurs (repond 201 avec un UtilisateurResponse).
 * Pas de mot de passe : le serveur en genere un temporaire, l'envoie par e-mail et ne le
 * renvoie jamais. 409 si l'e-mail existe deja, 503 si l'e-mail n'a pas pu partir (rien
 * n'est alors enregistre).
 */
export interface CreationCompteRequest {
  nomComplet: string;
  email: string;
  role: RoleCreable;
}

/** PATCH /api/admin/utilisateurs/{id}/activation. 400 si l'admin desactive son propre compte. */
export interface ActivationRequest {
  actif: boolean;
}

/** Longueurs maximales, identiques aux @Size de CreationCompteRequest. */
export const NOM_COMPLET_MAX = 255;
export const EMAIL_MAX = 255;
