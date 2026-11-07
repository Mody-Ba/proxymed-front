import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ACCES_REFUSE_GERE_PAR_LA_PAGE } from '../interceptors/auth.interceptor';
import { FichierTelecharge } from '../models/fiche-signee.model';
import {
  ImportLotResponse,
  ImpressionFichesRequest,
  PARTIE_FICHIERS_LOT,
  PatientIdentite,
  TypeVisite,
} from '../models/fiches-admin.model';
import { relireErreurBlob } from '../utils/erreur-blob';
import { nomFichierDepuisEntete } from '../utils/fichier';

/** Seuls champs lus dans PatientResponse : l'identite. */
interface PatientResponseIdentite {
  id: string;
  nomComplet: string | null;
  numeroDossierProxymed?: string | null;
  dateNaissance?: string | null;
}

/**
 * Parcours papier de l'admin (Fiche 1) : liste des patients (identite seule), impression combinee
 * des fiches vierges et import en lot des fiches remplies. Le serveur verifie le role ADMIN a
 * chaque appel ; chaque 403 est affiche par la page, sans redirection.
 */
@Injectable({ providedIn: 'root' })
export class FichesAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.fiche1}/api`;

  /** GET /api/patients (liste complete, non paginee par le serveur), reduite a l'identite. */
  listerPatients(): Observable<PatientIdentite[]> {
    return this.http
      .get<PatientResponseIdentite[]>(`${this.url}/patients`, { context: this.contexte() })
      .pipe(
        map((patients) =>
          (patients ?? []).map((p) => ({
            id: p.id,
            nomComplet: p.nomComplet ?? '',
            numeroDossierProxymed: p.numeroDossierProxymed ?? null,
            dateNaissance: p.dateNaissance ?? null,
          })),
        ),
      );
  }

  /**
   * POST /api/visites/impression : une visite vierge par patient, un seul PDF combine. Tout ou
   * rien. Le corps d'erreur (Blob) est relu en JSON pour que la page affiche le message du serveur.
   */
  imprimer(patientIds: readonly string[], typeVisite: TypeVisite): Observable<FichierTelecharge> {
    const corps: ImpressionFichesRequest = {
      fiches: patientIds.map((patientId) => ({ patientId, typeVisite })),
    };
    return this.http
      .post(`${this.url}/visites/impression`, corps, {
        responseType: 'blob',
        observe: 'response',
        context: this.contexte(),
      })
      .pipe(
        map((reponse: HttpResponse<Blob>) => ({
          contenu: reponse.body ?? new Blob([], { type: 'application/pdf' }),
          nomFichier: nomFichierDepuisEntete(
            reponse.headers.get('Content-Disposition'),
            'fiches.pdf',
          ),
        })),
        catchError((erreur: unknown) => relireErreurBlob(erreur)),
      );
  }

  /** POST /api/fiches-signees/import : partie "fichiers" repetee, type multipart pose par le navigateur. */
  importerLot(fichiers: readonly File[]): Observable<ImportLotResponse> {
    const formulaire = new FormData();
    for (const fichier of fichiers) {
      formulaire.append(PARTIE_FICHIERS_LOT, fichier, fichier.name);
    }
    return this.http.post<ImportLotResponse>(`${this.url}/fiches-signees/import`, formulaire, {
      context: this.contexte(),
    });
  }

  private contexte(): HttpContext {
    return new HttpContext().set(ACCES_REFUSE_GERE_PAR_LA_PAGE, true);
  }
}
