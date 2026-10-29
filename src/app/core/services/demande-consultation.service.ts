import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ACCES_REFUSE_GERE_PAR_LA_PAGE } from '../interceptors/auth.interceptor';
import {
  AcceptationDemandeRequest,
  DemandeConsultationRequest,
  DemandeConsultationResponse,
  RefusDemandeRequest,
  StatutDemandeConsultation,
} from '../models/demande-consultation.model';
import { PageResponse } from '../models/page.model';

/** Taille de page par defaut du serveur (TAILLE_DEFAUT). */
export const TAILLE_PAGE_DEFAUT = 20;

/**
 * Demandes de consultation initiale (Fiche 1). Le serveur ne renvoie a chaque role que ce qu'il
 * a le droit de voir : ce service ne filtre rien et ne garde aucune donnee medicale.
 * Ni identifiant de medecin senior ni statut ne partent jamais : le serveur les tire du badge.
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

  /**
   * Toutes les demandes (MEDECIN_SENIOR), filtrees par statut si besoin. Sans statut, le
   * parametre n'est pas envoye et le serveur renvoie tous les statuts.
   */
  toutes(
    statut: StatutDemandeConsultation | null,
    page = 0,
    taille = TAILLE_PAGE_DEFAUT,
  ): Observable<PageResponse<DemandeConsultationResponse>> {
    let params = new HttpParams().set('page', page).set('taille', taille);
    if (statut) {
      params = params.set('statut', statut);
    }
    return this.http.get<PageResponse<DemandeConsultationResponse>>(this.url, { params });
  }

  /** Demandes ACCEPTEES assignees au medecin junior connecte (identifie par le badge). */
  assigneesAMoi(
    page = 0,
    taille = TAILLE_PAGE_DEFAUT,
  ): Observable<PageResponse<DemandeConsultationResponse>> {
    const params = new HttpParams().set('page', page).set('taille', taille);
    return this.http.get<PageResponse<DemandeConsultationResponse>>(`${this.url}/assignees-a-moi`, {
      params,
    });
  }

  /** 409 si la demande n'est plus EN_ATTENTE (traitee entre-temps par un autre senior). */
  accepter(id: string, juniorId: string): Observable<DemandeConsultationResponse> {
    const corps: AcceptationDemandeRequest = { juniorId };
    return this.http.patch<DemandeConsultationResponse>(
      `${this.url}/${encodeURIComponent(id)}/accepter`,
      corps,
    );
  }

  /** 409 si la demande n'est plus EN_ATTENTE (traitee entre-temps par un autre senior). */
  refuser(id: string, motifRefus: string): Observable<DemandeConsultationResponse> {
    const corps: RefusDemandeRequest = { motifRefus };
    return this.http.patch<DemandeConsultationResponse>(
      `${this.url}/${encodeURIComponent(id)}/refuser`,
      corps,
    );
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
