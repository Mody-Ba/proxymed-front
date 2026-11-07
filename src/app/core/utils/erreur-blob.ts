import { HttpErrorResponse } from '@angular/common/http';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';

/**
 * Erreur d'une requete en responseType blob : le corps JSON du serveur (ErrorResponse) est relu
 * pour que messageErreur / detailsErreur / typeErreur fonctionnent comme pour une requete JSON.
 */
export function relireErreurBlob(erreur: unknown): Observable<never> {
  if (!(erreur instanceof HttpErrorResponse) || !(erreur.error instanceof Blob)) {
    return throwError(() => erreur);
  }
  return from(erreur.error.text()).pipe(
    catchError(() => throwError(() => erreur)),
    switchMap((texte) => {
      let corps: unknown = null;
      try {
        corps = JSON.parse(texte);
      } catch {
        corps = null;
      }
      return throwError(
        () =>
          new HttpErrorResponse({
            error: corps,
            headers: erreur.headers,
            status: erreur.status,
            statusText: erreur.statusText,
            url: erreur.url ?? undefined,
          }),
      );
    }),
  );
}
