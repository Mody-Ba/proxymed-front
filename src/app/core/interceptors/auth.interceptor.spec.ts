import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const CLE_SESSION = 'proxymed.session';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controleur: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  function configurer(connecte: boolean): void {
    sessionStorage.clear();
    if (connecte) {
      sessionStorage.setItem(
        CLE_SESSION,
        JSON.stringify({
          badge: 'badge-secret',
          role: 'MEDECIN_SENIOR',
          email: 'senior@proxymed.fr',
          expireLe: Date.now() + 3_600_000,
          motDePasseTemporaire: false,
        }),
      );
    }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpClient);
    controleur = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  }

  afterEach(() => {
    controleur.verify();
    sessionStorage.clear();
  });

  it.each([
    `${environment.api.auth}/api/auth/moi`,
    `${environment.api.fiche1}/api/consultations`,
    `${environment.api.fiche2}/api/suivis`,
  ])('ajoute Authorization: Bearer vers %s', (url) => {
    configurer(true);
    http.get(url).subscribe();

    const requete = controleur.expectOne(url);
    expect(requete.request.headers.get('Authorization')).toBe('Bearer badge-secret');
    requete.flush({});
  });

  it.each([
    'https://exemple.com/api',
    'http://localhost:8083.exemple.com/api/auth/moi',
    'http://localhost:80830/api',
    'https://localhost:8083/api/auth/moi',
    'http://localhost:9999/api',
  ])("n'envoie jamais le badge vers %s", (url) => {
    configurer(true);
    http.get(url).subscribe();

    const requete = controleur.expectOne(url);
    expect(requete.request.headers.has('Authorization')).toBe(false);
    requete.flush({});
  });

  it("n'ajoute pas d'en-tete quand personne n'est connecte", () => {
    configurer(false);
    const url = `${environment.api.auth}/api/auth/connexion`;
    http.post(url, {}).subscribe();

    const requete = controleur.expectOne(url);
    expect(requete.request.headers.has('Authorization')).toBe(false);
    requete.flush({});
  });

  it('sur 401 : deconnecte et renvoie vers /connexion avec le message du serveur', () => {
    configurer(true);
    const url = `${environment.api.fiche1}/api/consultations`;
    let erreurRecue: unknown;
    http.get(url).subscribe({ error: (e) => (erreurRecue = e) });

    controleur
      .expectOne(url)
      .flush(
        {
          horodatage: '',
          status: 401,
          erreur: 'Non authentifie',
          message: 'Badge invalide ou expire',
          details: [],
        },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(erreurRecue).toBeTruthy();
    expect(auth.estConnecte()).toBe(false);
    expect(sessionStorage.getItem(CLE_SESSION)).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/connexion');
    expect(auth.consommerMessageConnexion()).toBe('Badge invalide ou expire');
  });

  it('sur 403 : renvoie vers /acces-refuse sans deconnecter', () => {
    configurer(true);
    const url = `${environment.api.fiche2}/api/suivis`;
    http.get(url).subscribe({ error: () => undefined });

    controleur
      .expectOne(url)
      .flush(
        {
          horodatage: '',
          status: 403,
          erreur: 'Acces refuse',
          message: 'Votre role ne permet pas',
          details: [],
        },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(router.navigateByUrl).toHaveBeenCalledWith('/acces-refuse');
    expect(auth.estConnecte()).toBe(true);
  });

  it('laisse la page de connexion afficher un 401 (identifiants invalides)', () => {
    configurer(false);
    const url = `${environment.api.auth}/api/auth/connexion`;
    http.post(url, {}).subscribe({ error: () => undefined });

    controleur
      .expectOne(url)
      .flush(
        {
          horodatage: '',
          status: 401,
          erreur: 'Authentification echouee',
          message: 'Identifiants invalides',
          details: [],
        },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it("ne reagit pas aux 401/403 d'une autre adresse", () => {
    configurer(true);
    const url = 'https://exemple.com/api';
    http.get(url).subscribe({ error: () => undefined });

    controleur.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estConnecte()).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
