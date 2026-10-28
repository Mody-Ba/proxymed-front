/** Roles du badge, identiques a l'enum Role du service d'authentification. */
export type Role = 'UTILISATEUR' | 'MEDECIN_JUNIOR' | 'MEDECIN_SENIOR' | 'ADMIN';

export const LIBELLES_ROLE: Record<Role, string> = {
  UTILISATEUR: 'Patient ou proche',
  MEDECIN_JUNIOR: 'Médecin junior',
  MEDECIN_SENIOR: 'Médecin senior',
  ADMIN: 'Administrateur',
};

/** Page d'accueil de chaque role apres la connexion. */
export const ACCUEIL_PAR_ROLE: Record<Role, string> = {
  UTILISATEUR: '/patient',
  MEDECIN_JUNIOR: '/junior',
  MEDECIN_SENIOR: '/senior',
  ADMIN: '/admin',
};
