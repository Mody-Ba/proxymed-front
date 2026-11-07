import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ACCES_REFUSE_GERE_PAR_LA_PAGE } from '../interceptors/auth.interceptor';
import { FichierTelecharge } from '../models/fiche-signee.model';
import { PageResponse } from '../models/page.model';
import {
  DecisionLotResponse,
  FicheAViserResponse,
  RenvoiLotRequest,
  StatutFicheSignee,
  TAILLE_PAGE_FICHES,
  VisaLotRequest,
} from '../models/visa-fiche.model';
import { relireErreurBlob } from '../utils/erreur-blob';
import { nomFichierDepuisEntete } from '../utils/fichier';

/**
 * Visa des fiches scannees par le medecin senior (Fiche 1). Le senior qui vise vient du badge,
 * jamais du corps. Le serveur verifie le role a chaque appel ; chaque 403 est affiche par la page.
 */
@Injectable({ providedIn: 'root' })
export class VisaFicheService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.fiche1}/api`;

  /** GET /api/fiches-signees?statut=&page=&taille= : de la plus ancienne a la plus recente importee. */
  lister(
    statut: StatutFicheSignee,
    page = 0,
    taille = TAILLE_PAGE_FICHES,
  ): Observable<PageResponse<FicheAViserResponse>> {
    const params = new HttpParams().set('statut', statut).set('page', page).set('taille', taille);
    return this.http.get<PageResponse<FicheAViserResponse>>(`${this.url}/fiches-signees`, {
      params,
      context: this.contexte(),
    });
  }

  /** POST /api/fiches-signees/visa : une transaction par fiche, toujours 200 si la requete est valide. */
  viser(visiteIds: readonly string[]): Observable<DecisionLotResponse> {
    const corps: VisaLotRequest = { visiteIds: [...visiteIds] };
    return this.http.post<DecisionLotResponse>(`${this.url}/fiches-signees/visa`, corps, {
      context: this.contexte(),
    });
  }

  /** POST /api/fiches-signees/renvoi : meme motif pour toutes les fiches. */
  renvoyer(visiteIds: readonly string[], motif: string): Observable<DecisionLotResponse> {
    const corps: RenvoiLotRequest = { visiteIds: [...visiteIds], motif };
    return this.http.post<DecisionLotResponse>(`${this.url}/fiches-signees/renvoi`, corps, {
      context: this.contexte(),
    });
  }

  /** GET /api/consultations/{visiteId}/fiche-signee : scan importe. */
  telechargerScan(visiteId: string): Observable<FichierTelecharge> {
    return this.telecharger(
      `${this.url}/consultations/${encodeURIComponent(visiteId)}/fiche-signee`,
      'fiche-signee.pdf',
    );
  }

  /** GET /api/fiches-signees/{consultationId}/rapport : fiche VISEE seulement (409 sinon). */
  telechargerRapport(visiteId: string): Observable<FichierTelecharge> {
    return this.telecharger(
      `${this.url}/fiches-signees/${encodeURIComponent(visiteId)}/rapport`,
      'rapport.pdf',
    );
  }

  private telecharger(url: string, nomParDefaut: string): Observable<FichierTelecharge> {
    return this.http
      .get(url, { responseType: 'blob', observe: 'response', context: this.contexte() })
      .pipe(
        map((reponse: HttpResponse<Blob>) => ({
          contenu: reponse.body ?? new Blob([], { type: 'application/pdf' }),
          nomFichier: nomFichierDepuisEntete(
            reponse.headers.get('Content-Disposition'),
            nomParDefaut,
          ),
        })),
        // L'erreur arrive en Blob : relue en JSON pour afficher le message du serveur.
        catchError((erreur: unknown) => relireErreurBlob(erreur)),
      );
  }

  private contexte(): HttpContext {
    return new HttpContext().set(ACCES_REFUSE_GERE_PAR_LA_PAGE, true);
  }
}
