import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ACCES_REFUSE_GERE_PAR_LA_PAGE } from '../interceptors/auth.interceptor';
import {
  FicheSigneeResponse,
  FichierTelecharge,
  PARTIE_FICHIER_IMPORT,
} from '../models/fiche-signee.model';
import { nomFichierDepuisEntete } from '../utils/fichier';

/** Seule partie lue de GET /api/consultations/{id} : l'identifiant du patient. */
interface ConsultationPatient {
  patient: { id: string } | null;
}

/**
 * Fiche 1 sur papier : PDF a remplir (avec son code QR), import du scan rempli et signe, et
 * lecture de la fiche deja importee. Le serveur applique seul les regles d'acces : chaque 403
 * est affiche par la page, sans redirection. Ce service ne garde aucune donnee.
 */
@Injectable({ providedIn: 'root' })
export class FicheConsultationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.fiche1}/api`;

  /** GET /api/consultations/{id}/pdf : fiche a imprimer, preremplie, avec son code QR. */
  telechargerFiche(consultationId: string): Observable<FichierTelecharge> {
    const id = encodeURIComponent(consultationId);
    return this.telecharger(`${this.url}/consultations/${id}/pdf`, 'fiche-consultation.pdf');
  }

  /** GET /api/consultations/{id}/fiche-signee : scan importe (404 si aucun). */
  telechargerFicheSignee(consultationId: string): Observable<FichierTelecharge> {
    const id = encodeURIComponent(consultationId);
    return this.telecharger(`${this.url}/consultations/${id}/fiche-signee`, 'fiche-signee.pdf');
  }

  /**
   * POST /api/fiches-signees/import, sans aucun identifiant : la consultation est lue dans le
   * code QR. Le type multipart (avec sa frontiere) est pose par le navigateur.
   */
  importer(fichier: File): Observable<FicheSigneeResponse> {
    const formulaire = new FormData();
    formulaire.append(PARTIE_FICHIER_IMPORT, fichier, fichier.name);
    return this.http.post<FicheSigneeResponse>(`${this.url}/fiches-signees/import`, formulaire, {
      context: this.contexte(),
    });
  }

  /**
   * Fiche deja importee pour la consultation, ou null. Le serveur n'expose ces metadonnees que
   * par patient : la consultation donne l'identifiant du patient, puis la liste est filtree.
   */
  ficheSigneeDeLaConsultation(consultationId: string): Observable<FicheSigneeResponse | null> {
    const id = encodeURIComponent(consultationId);
    return this.http
      .get<ConsultationPatient>(`${this.url}/consultations/${id}`, { context: this.contexte() })
      .pipe(
        switchMap((consultation) => {
          const patientId = consultation.patient?.id;
          if (!patientId) {
            return of(null);
          }
          return this.http
            .get<FicheSigneeResponse[]>(
              `${this.url}/patients/${encodeURIComponent(patientId)}/fiches-signees`,
              { context: this.contexte() },
            )
            .pipe(map((fiches) => fiches.find((f) => f.consultationId === consultationId) ?? null));
        }),
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
      );
  }

  private contexte(): HttpContext {
    return new HttpContext().set(ACCES_REFUSE_GERE_PAR_LA_PAGE, true);
  }
}
