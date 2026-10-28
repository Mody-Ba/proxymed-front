import { Role } from './role.model';

/** POST /api/auth/connexion */
export interface ConnexionRequest {
  email: string;
  motDePasse: string;
}

export interface ConnexionResponse {
  accessToken: string;
  type: string;
  expireDansSecondes: number;
  utilisateurId: string;
  email: string;
  role: Role;
  motDePasseTemporaire: boolean;
}

/** GET /api/auth/moi */
export interface UtilisateurResponse {
  id: string;
  email: string;
  nomComplet: string;
  role: Role;
  actif: boolean;
  motDePasseTemporaire: boolean;
  dateCreation: string;
}

/** POST /api/auth/changer-mot-de-passe (repond 204) */
export interface ChangementMotDePasseRequest {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
}
