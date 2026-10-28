import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { DemandeConsultationResponse } from '../models/demande-consultation.model';
import { DemandeConsultationService } from './demande-consultation.service';

const URL_DEMANDES = `${environment.api.fiche1}/api/demandes-consultation`;
const CLE_SESSION = 'proxymed.session';
const MOTIF = 'Douleurs thoraciques depuis trois jours';
const NOM = 'Awa Diallo';

const demande: DemandeConsultationResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  demandeurId: '11111111-1111-1111-1111-111111111111',
  nomPatient: NOM,
  pourProche: false,
  motif: MOTIF,
  statut: 'EN_ATTENTE',
  medecinSeniorId: null,
  juniorId: null,
  motifRefus: null,
  dateCreation: '2026-10-28T10:00:00Z',
  dateDecision: null,
};

describe('DemandeConsultationService', () => {
  let service: DemandeConsultationService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem(
      CLE_SESSION,
      JSON.stringify({
        badge: 'badge-patient',
        role: 'UTILISATEUR',
        email: 'patient@proxymed.fr',
        expireLe: Date.now() + 3_600_000,
        motDePasseTemporaire: false,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    service = TestBed.inject(DemandeConsultationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('cree une demande avec seulement nomPatient, pourProche et motif', () => {
    service.creer({ nomPatient: NOM, pourProche: true, motif: MOTIF }).subscribe();

    const requete = http.expectOne(URL_DEMANDES);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ nomPatient: NOM, pourProche: true, motif: MOTIF });
    expect(requete.request.headers.get('Authorization')).toBe('Bearer badge-patient');
    requete.flush(demande, { status: 201, statusText: 'Created' });
  });

  it("n'envoie jamais d'identifiant de demandeur ni de statut, meme si on lui en passe", () => {
    const tricheur = {
      nomPatient: NOM,
      pourProche: false,
      motif: MOTIF,
      demandeurId: 'un-autre-compte',
      statut: 'ACCEPTEE',
    };
    service.creer(tricheur).subscribe();

    const corps = http.expectOne(URL_DEMANDES).request.body as Record<string, unknown>;
    expect(Object.keys(corps).sort()).toEqual(['motif', 'nomPatient', 'pourProche']);
    expect(corps).not.toHaveProperty('demandeurId');
    expect(corps).not.toHaveProperty('statut');
  });

  it('lit mes demandes avec page et taille (20 par defaut)', () => {
    service.mesDemandes().subscribe();

    const requete = http.expectOne((r) => r.url === `${URL_DEMANDES}/mes-demandes`);
    expect(requete.request.method).toBe('GET');
    expect(requete.request.params.get('page')).toBe('0');
    expect(requete.request.params.get('taille')).toBe('20');
    requete.flush({ elements: [], page: 0, taille: 20, totalElements: 0, totalPages: 0 });
  });

  it('transmet la page et la taille demandees', () => {
    service.mesDemandes(3, 50).subscribe();

    const requete = http.expectOne((r) => r.url === `${URL_DEMANDES}/mes-demandes`);
    expect(requete.request.urlWithParams).toBe(`${URL_DEMANDES}/mes-demandes?page=3&taille=50`);
    requete.flush({ elements: [], page: 3, taille: 50, totalElements: 0, totalPages: 0 });
  });

  it("lit une demande par son identifiant, seule donnee placee dans l'URL", () => {
    let recue: DemandeConsultationResponse | undefined;
    service.findById(demande.id).subscribe((d) => (recue = d));

    const requete = http.expectOne(`${URL_DEMANDES}/${demande.id}`);
    expect(requete.request.method).toBe('GET');
    requete.flush(demande);
    expect(recue).toEqual(demande);
  });

  it('sur 403 du detail : laisse la page afficher le message, sans redirection', () => {
    let erreur: unknown;
    service.findById(demande.id).subscribe({ error: (e: unknown) => (erreur = e) });

    http
      .expectOne(`${URL_DEMANDES}/${demande.id}`)
      .flush(
        { horodatage: '', status: 403, erreur: 'Acces refuse', message: 'Refuse', details: [] },
        { status: 403, statusText: 'Forbidden' },
      );

    expect((erreur as HttpErrorResponse).status).toBe(403);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('ne garde aucune donnee medicale dans le stockage du navigateur ni dans la console', () => {
    const journal = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'debug'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ];
    service.creer({ nomPatient: NOM, pourProche: false, motif: MOTIF }).subscribe();
    http.expectOne(URL_DEMANDES).flush(demande, { status: 201, statusText: '' });
    service.findById(demande.id).subscribe();
    http.expectOne(`${URL_DEMANDES}/${demande.id}`).flush(demande);

    const stockage = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stockage).not.toContain(MOTIF);
    expect(stockage).not.toContain(NOM);
    for (const espion of journal) {
      expect(espion).not.toHaveBeenCalled();
    }
  });

  it('transmet le message de succes une seule fois a la liste', () => {
    service.annoncerSurListe('Votre demande a été envoyée.');
    expect(service.consommerMessageListe()).toBe('Votre demande a été envoyée.');
    expect(service.consommerMessageListe()).toBeNull();
  });
});
