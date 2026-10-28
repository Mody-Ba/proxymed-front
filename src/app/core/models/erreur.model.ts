/** Format d'erreur commun aux trois services PROXYMED (ErrorResponse cote serveur). */
export interface ErrorResponse {
  horodatage: string;
  status: number;
  erreur: string;
  message: string;
  details: string[];
}
