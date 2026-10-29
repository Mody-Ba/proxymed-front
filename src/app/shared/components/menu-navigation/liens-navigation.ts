import { Role } from '../../../core/models/role.model';

export interface LienNavigation {
  libelle: string;
  lien: string;
  /** Icone Material, decorative. */
  icone: string;
}

/**
 * Entrees du menu principal par role (affichage seulement : le serveur protege les donnees).
 * Les prochains ecrans (medecins, admin) ajoutent leurs entrees ici.
 */
export const LIENS_PAR_ROLE: Record<Role, readonly LienNavigation[]> = {
  UTILISATEUR: [
    { libelle: 'Nouvelle demande', lien: '/patient/nouvelle-demande', icone: 'note_add' },
    { libelle: 'Mes demandes', lien: '/patient/mes-demandes', icone: 'list_alt' },
  ],
  MEDECIN_SENIOR: [],
  MEDECIN_JUNIOR: [],
  ADMIN: [],
};
