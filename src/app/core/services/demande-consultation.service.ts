import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ACCES_REFUSE_GERE_PAR_LA_PAGE } from '../interceptors/auth.interceptor';
import {
  DemandeConsultationRequest,
  DemandeConsultationResponse,
} from '../models/demande-consultation.model';
import { PageResponse } from '../models/page.model';

/** Taille de page par defaut du serveur (TAILLE_DEFAUT). */
export const TAILLE_PAGE_DEFAUT = 20;

/**
 * Demandes de consultation initiale du patient (Fiche 1). Le serveur ne renvoie au patient que
 * ses propres demandes : ce service ne filtre rien et ne garde aucune donnee medicale.
 */
@Injectable({ providedIn: 'root' })
export class DemandeConsultationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.fiche1}/api/demandes-consultation`;

  private readonly _messageListe = signal<string | null>(null);

  creer(demande: DemandeConsultationRequest): Observable<DemandeConsultationResponse> {
    // Corps reconstruit champ par champ : aucun autre champ (demandeur, statut...) ne part.
    const corps: DemandeConsultationRequest = {
      nomPatient: demande.nomPatient,
      pourProche: demande.pourProche,
      motif: demande.motif,
    };
    return this.http.post<DemandeConsultationResponse>(this.url, corps);
  }

  /** Demandes du compte connecte, de la plus recente a la plus ancienne (tri fixe du serveur). */
  mesDemandes(
    page = 0,
    taille = TAILLE_PAGE_DEFAUT,
  ): Observable<PageResponse<DemandeConsultationResponse>> {
    const params = new HttpParams().set('page', page).set('taille', taille);
    return this.http.get<PageResponse<DemandeConsultationResponse>>(`${this.url}/mes-demandes`, {
      params,
    });
  }

  /** Un 403 (demande d'un autre compte) est affiche par la page de detail, sans redirection. */
  findById(id: string): Observable<DemandeConsultationResponse> {
    return this.http.get<DemandeConsultationResponse>(`${this.url}/${encodeURIComponent(id)}`, {
      context: new HttpContext().set(ACCES_REFUSE_GERE_PAR_LA_PAGE, true),
    });
  }

  /** Message a afficher a la prochaine ouverture de la liste (demande envoyee). */
  annoncerSurListe(message: string): void {
    this._messageListe.set(message);
  }

  /** Lu une fois par la page de liste. */
  consommerMessageListe(): string | null {
    const message = this._messageListe();
    this._messageListe.set(null);
    return message;
  }
}
