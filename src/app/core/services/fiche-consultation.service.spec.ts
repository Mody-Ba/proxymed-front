import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { FicheSigneeResponse, FichierTelecharge } from '../models/fiche-signee.model';
import { FicheConsultationService } from './fiche-consultation.service';

const API = `${environment.api.fiche1}/api`;
const CONSULTATION = '44444444-4444-4444-4444-444444444444';
const PATIENT = '55555555-5555-5555-5555-555555555555';

const fiche: FicheSigneeResponse = {
  id: 'f-1',
  patientId: PATIENT,
  consultationId: CONSULTATION,
  dateConsultation: '2026-10-30',
  nomFichier: 'scan.pdf',
  tailleOctets: 2048,
  dateImport: '2026-10-31T09:30:00Z',
};

describe('FicheConsultationService', () => {
  let service: FicheConsultationService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(FicheConsultationService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('telecharge la fiche en blob avec le nom de Content-Disposition', () => {
    let recu: FichierTelecharge | undefined;
    service.telechargerFiche(CONSULTATION).subscribe((f) => (recu = f));

    const requete = http.expectOne(`${API}/consultations/${CONSULTATION}/pdf`);
    expect(requete.request.method).toBe('GET');
    expect(requete.request.responseType).toBe('blob');
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    requete.flush(pdf, {
      headers: {
        'Content-Disposition': `attachment; filename="fiche-consultation-${CONSULTATION}.pdf"`,
      },
    });

    expect(recu!.contenu).toBe(pdf);
    expect(recu!.nomFichier).toBe(`fiche-consultation-${CONSULTATION}.pdf`);
  });

  it('sans Content-Disposition : nom sur par defaut', () => {
    let recu: FichierTelecharge | undefined;
    service.telechargerFicheSignee(CONSULTATION).subscribe((f) => (recu = f));

    const requete = http.expectOne(`${API}/consultations/${CONSULTATION}/fiche-signee`);
    expect(requete.request.responseType).toBe('blob');
    requete.flush(new Blob(['%PDF-']));

    expect(recu!.nomFichier).toBe('fiche-signee.pdf');
  });

  it('importe en FormData avec la partie « fichier », sans aucun identifiant', () => {
    const fichier = new File(['%PDF-1.7'], 'scan.pdf', { type: 'application/pdf' });
    let recue: FicheSigneeResponse | undefined;
    service.importer(fichier).subscribe((r) => (recue = r));

    const requete = http.expectOne(`${API}/fiches-signees/import`);
    expect(requete.request.method).toBe('POST');
    const corps = requete.request.body as FormData;
    expect(corps).toBeInstanceOf(FormData);
    expect(Array.from(corps.keys())).toEqual(['fichier']);
    expect((corps.get('fichier') as File).name).toBe('scan.pdf');
    // Le navigateur pose lui-meme multipart/form-data avec sa frontiere.
    expect(requete.request.headers.has('Content-Type')).toBe(false);
    requete.flush(fiche, { status: 201, statusText: 'Created' });

    expect(recue).toEqual(fiche);
  });

  it('un 403 de l’import n’entraine aucune redirection : la page l’affiche', () => {
    let erreur: HttpErrorResponse | undefined;
    service
      .importer(new File(['%PDF-'], 'scan.pdf', { type: 'application/pdf' }))
      .subscribe({ error: (e: HttpErrorResponse) => (erreur = e) });

    http
      .expectOne(`${API}/fiches-signees/import`)
      .flush({ erreur: 'Acces refuse' }, { status: 403, statusText: 'Forbidden' });

    expect(erreur!.status).toBe(403);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  describe('fiche deja importee', () => {
    it('lit le patient de la consultation puis filtre sa liste de fiches', () => {
      let recue: FicheSigneeResponse | null | undefined;
      service.ficheSigneeDeLaConsultation(CONSULTATION).subscribe((r) => (recue = r));

      http.expectOne(`${API}/consultations/${CONSULTATION}`).flush({ patient: { id: PATIENT } });
      http
        .expectOne(`${API}/patients/${PATIENT}/fiches-signees`)
        .flush([{ ...fiche, id: 'autre', consultationId: 'autre-consultation' }, fiche]);

      expect(recue).toEqual(fiche);
    });

    it('aucune fiche pour cette consultation : null', () => {
      let recue: FicheSigneeResponse | null | undefined;
      service.ficheSigneeDeLaConsultation(CONSULTATION).subscribe((r) => (recue = r));

      http.expectOne(`${API}/consultations/${CONSULTATION}`).flush({ patient: { id: PATIENT } });
      http.expectOne(`${API}/patients/${PATIENT}/fiches-signees`).flush([]);

      expect(recue).toBeNull();
    });

    it('consultation sans patient : null, sans seconde requete', () => {
      let recue: FicheSigneeResponse | null | undefined;
      service.ficheSigneeDeLaConsultation(CONSULTATION).subscribe((r) => (recue = r));

      http.expectOne(`${API}/consultations/${CONSULTATION}`).flush({ patient: null });

      expect(recue).toBeNull();
    });
  });
});
