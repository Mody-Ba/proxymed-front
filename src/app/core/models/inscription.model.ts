/** POST /api/auth/inscription (repond 202) */
export interface InscriptionRequest {
  nomComplet: string;
  email: string;
  motDePasse: string;
}

/** POST /api/auth/verification (repond 201 avec un UtilisateurResponse) */
export interface VerificationRequest {
  email: string;
  code: string;
}

/** POST /api/auth/renvoyer-code */
export interface RenvoyerCodeRequest {
  email: string;
}

/** Reponse de /inscription et /renvoyer-code. Ne porte jamais le code. */
export interface InscriptionEnAttenteResponse {
  message: string;
  email: string;
  codeExpireLe: string;
  renvoiPossibleLe: string;
}
