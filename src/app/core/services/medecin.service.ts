import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MedecinJuniorResponse } from '../models/medecin.model';

/** Medecins du service d'authentification (l'intercepteur y joint le badge). */
@Injectable({ providedIn: 'root' })
export class MedecinService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.auth}/api/auth`;

  /** Juniors actifs (MEDECIN_SENIOR), pour assigner une demande acceptee. */
  juniors(): Observable<MedecinJuniorResponse[]> {
    return this.http.get<MedecinJuniorResponse[]>(`${this.url}/medecins-juniors`);
  }
}
