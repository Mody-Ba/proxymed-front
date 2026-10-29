import { Role } from '../../../core/models/role.model';

export interface LienNavigation {
  libelle: string;
  lien: string;
  /** Icone Material, decorative. */
  icone: string;
}

/**
 * Entrees du menu principal par role (affichage seulement : le serveur protege les donnees).
 * Les prochains ecrans (admin) ajoutent leurs entrees ici.
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
  ADMIN: [],
};
