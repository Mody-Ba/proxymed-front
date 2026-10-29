import { Role } from '../../../core/models/role.model';

export interface LienNavigation {
  libelle: string;
  lien: string;
  /** Icone Material, decorative. */
  icone: string;
  /** Actif seulement sur cette adresse exacte (pas sur ses sous-pages). */
  exact?: boolean;
}

/**
 * Entrees du menu principal par role (affichage seulement : le serveur protege les donnees).
 */
export const LIENS_PAR_ROLE: Record<Role, readonly LienNavigation[]> = {
  UTILISATEUR: [
    { libelle: 'Nouvelle demande', lien: '/patient/nouvelle-demande', icone: 'note_add' },
    { libelle: 'Mes demandes', lien: '/patient/mes-demandes', icone: 'list_alt' },
  ],
  MEDECIN_SENIOR: [{ libelle: 'Demandes', lien: '/senior/demandes', icone: 'inbox' }],
  MEDECIN_JUNIOR: [
    { libelle: 'Demandes assignées', lien: '/junior/demandes', icone: 'assignment_ind' },
  ],
  // L'administrateur ne voit aucun lien vers les donnees medicales.
  ADMIN: [
    { libelle: 'Comptes', lien: '/admin/comptes', icone: 'manage_accounts', exact: true },
    { libelle: 'Créer un médecin', lien: '/admin/comptes/nouveau', icone: 'person_add' },
  ],
};
