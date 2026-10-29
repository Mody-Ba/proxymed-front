import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActivationRequest, CreationCompteRequest } from '../models/admin.model';
import { UtilisateurResponse } from '../models/auth.model';
import { PageContenuResponse } from '../models/page.model';
import { Role } from '../models/role.model';

/** Taille de page par defaut du serveur. */
export const TAILLE_PAGE_COMPTES = 20;

/**
 * Administration des comptes (service d'authentification, role ADMIN verifie par le serveur
 * a chaque appel). Aucun mot de passe ne part ni ne revient : le serveur genere les mots de
 * passe temporaires et les envoie lui-meme par e-mail.
 */
@Injectable({ providedIn: 'root' })
export class AdminUtilisateurService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.auth}/api/admin/utilisateurs`;

  private readonly _messageListe = signal<string | null>(null);

  creer(compte: CreationCompteRequest): Observable<UtilisateurResponse> {
    // Corps reconstruit champ par champ : aucun autre champ ne part.
    const corps: CreationCompteRequest = {
      nomComplet: compte.nomComplet,
      email: compte.email,
      role: compte.role,
    };
    return this.http.post<UtilisateurResponse>(this.url, corps);
  }

  /** Du plus recent au plus ancien (tri fixe du serveur). Sans role, tous les comptes. */
  lister(
    role: Role | null,
    page = 0,
    taille = TAILLE_PAGE_COMPTES,
  ): Observable<PageContenuResponse<UtilisateurResponse>> {
    let params = new HttpParams().set('page', page).set('taille', taille);
    if (role) {
      params = params.set('role', role);
    }
    return this.http.get<PageContenuResponse<UtilisateurResponse>>(this.url, { params });
  }

  findById(id: string): Observable<UtilisateurResponse> {
    return this.http.get<UtilisateurResponse>(`${this.url}/${encodeURIComponent(id)}`);
  }

  changerActivation(id: string, actif: boolean): Observable<UtilisateurResponse> {
    const corps: ActivationRequest = { actif };
    return this.http.patch<UtilisateurResponse>(
      `${this.url}/${encodeURIComponent(id)}/activation`,
      corps,
    );
  }

  /** 503 si l'e-mail n'a pas pu partir : l'ancien mot de passe reste alors valable. */
  reinitialiserMotDePasse(id: string): Observable<UtilisateurResponse> {
    return this.http.post<UtilisateurResponse>(
      `${this.url}/${encodeURIComponent(id)}/reinitialiser-mot-de-passe`,
      null,
    );
  }

  /** Message a afficher a la prochaine ouverture de la liste (compte cree). */
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
