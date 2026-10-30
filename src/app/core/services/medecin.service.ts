import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MedecinFiche1Response, MedecinJuniorResponse } from '../models/medecin.model';

/**
 * Medecins : comptes du service d'authentification, et medecins de la Fiche 1 (deux listes
 * distinctes, pas encore reliees). L'intercepteur joint le badge aux deux services.
 */
@Injectable({ providedIn: 'root' })
export class MedecinService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.auth}/api/auth`;
  private readonly urlFiche1 = `${environment.api.fiche1}/api/medecins`;

  /** Juniors actifs (MEDECIN_SENIOR), pour assigner une demande acceptee. */
  juniors(): Observable<MedecinJuniorResponse[]> {
    return this.http.get<MedecinJuniorResponse[]>(`${this.url}/medecins-juniors`);
  }

  /** Medecins seniors de la Fiche 1, pour choisir le responsable d'une consultation initiale. */
  seniorsFiche1(): Observable<MedecinFiche1Response[]> {
    const params = new HttpParams().set('role', 'SENIOR');
    return this.http.get<MedecinFiche1Response[]>(this.urlFiche1, { params });
  }
}
