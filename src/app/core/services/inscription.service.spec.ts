import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { InscriptionEnAttenteResponse } from '../models/inscription.model';
import { AuthService } from './auth.service';
import { InscriptionService } from './inscription.service';

const URL_AUTH = `${environment.api.auth}/api/auth`;
const CLE_SESSION = 'proxymed.session';
const MOT_DE_PASSE = 'MotDePasse-Secret-42';

const enAttente: InscriptionEnAttenteResponse = {
  message: 'Un code de verification a ete envoye a patient@proxymed.fr',
  email: 'patient@proxymed.fr',
  codeExpireLe: '2026-10-28T10:10:00Z',
  renvoiPossibleLe: '2026-10-28T10:01:00Z',
};

function erreurServeur(status: number, message: string) {
  return { horodatage: '', status, erreur: 'Erreur', message, details: [] };
}

describe('InscriptionService', () => {
  let service: InscriptionService;
  let http: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  /** Avec l'intercepteur reel, pour verifier qu'aucune erreur de ces appels ne deconnecte. */
  function creerService(connecte = false): void {
    if (connecte) {
      sessionStorage.setItem(
        CLE_SESSION,
        JSON.stringify({
          badge: 'badge-secret',
          role: 'UTILISATEUR',
          email: 'autre@proxymed.fr',
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
    service = TestBed.inject(InscriptionService);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  function inscrire(): void {
    service
      .inscrire({
        nomComplet: 'Awa Diallo',
        email: 'patient@proxymed.fr',
        motDePasse: MOT_DE_PASSE,
      })
      .subscribe();
    http.expectOne(`${URL_AUTH}/inscription`).flush(enAttente, { status: 202, statusText: '' });
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    http?.verify();
    vi.useRealTimers();
  });

  it("envoie nomComplet, email et motDePasse, puis garde l'email en memoire", () => {
    creerService();
    service
      .inscrire({
        nomComplet: 'Awa Diallo',
        email: 'patient@proxymed.fr',
        motDePasse: MOT_DE_PASSE,
      })
      .subscribe();

    const requete = http.expectOne(`${URL_AUTH}/inscription`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({
      nomComplet: 'Awa Diallo',
      email: 'patient@proxymed.fr',
      motDePasse: MOT_DE_PASSE,
    });
    requete.flush(enAttente, { status: 202, statusText: 'Accepted' });

    expect(service.email()).toBe('patient@proxymed.fr');
  });

  it('ne garde jamais le mot de passe (ni en memoire, ni dans le stockage du navigateur)', () => {
    creerService();
    inscrire();

    expect(JSON.stringify(service.enCours())).not.toContain(MOT_DE_PASSE);
    expect(Object.keys(service.enCours() ?? {})).toEqual(['email', 'renvoiPossibleLe']);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(MOT_DE_PASSE);
    expect(JSON.stringify({ ...localStorage })).not.toContain(MOT_DE_PASSE);
  });

  it('autorise un renvoi 60 secondes apres la reception', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    creerService();
    inscrire();

    expect(service.enCours()?.renvoiPossibleLe).toBe(Date.now() + 60_000);
  });

  it("verifie le code avec l'email gardé, puis oublie l'inscription", () => {
    creerService();
    inscrire();
    service.verifier('123456').subscribe();

    const requete = http.expectOne(`${URL_AUTH}/verification`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ email: 'patient@proxymed.fr', code: '123456' });
    requete.flush({ id: '1', email: 'patient@proxymed.fr' }, { status: 201, statusText: '' });

    expect(service.enCours()).toBeNull();
  });

  it("renvoie un code avec l'email gardé et redemarre le delai", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    creerService();
    inscrire();
    vi.setSystemTime(new Date('2026-10-28T10:02:00Z'));
    service.renvoyerCode().subscribe();

    const requete = http.expectOne(`${URL_AUTH}/renvoyer-code`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ email: 'patient@proxymed.fr' });
    requete.flush(enAttente);

    expect(service.enCours()?.renvoiPossibleLe).toBe(Date.now() + 60_000);
  });

  describe('erreurs : affichees dans la page, sans deconnexion ni redirection', () => {
    it.each([
      ['inscription', 409, 'Un compte existe deja avec cet email'],
      ['inscription', 400, 'Un ou plusieurs champs sont invalides'],
      ['inscription', 429, "Un code vient d'etre envoye. Reessayez dans 42 seconde(s)."],
      ['inscription', 503, "L'email n'a pas pu etre envoye. Reessayez plus tard."],
      ['verification', 400, 'Code incorrect. Il reste 4 essai(s).'],
      ['verification', 401, 'Non authentifie'],
      ['verification', 403, 'Acces refuse'],
      ['renvoyer-code', 429, "Un code vient d'etre envoye. Reessayez dans 12 seconde(s)."],
      ['renvoyer-code', 503, "L'email n'a pas pu etre envoye. Reessayez plus tard."],
      ['inscription', 401, 'Non authentifie'],
    ] as const)('%s %i', (appel, status, message) => {
      creerService(true);
      if (appel !== 'inscription') {
        inscrire();
      }
      let erreurRecue: unknown;
      const observable: Observable<unknown> =
        appel === 'inscription'
          ? service.inscrire({ nomComplet: 'A', email: 'a@b.fr', motDePasse: MOT_DE_PASSE })
          : appel === 'verification'
            ? service.verifier('000000')
            : service.renvoyerCode();
      observable.subscribe({ error: (e: unknown) => (erreurRecue = e) });

      http
        .expectOne(`${URL_AUTH}/${appel}`)
        .flush(erreurServeur(status, message), { status, statusText: '' });

      expect((erreurRecue as HttpErrorResponse).status).toBe(status);
      expect((erreurRecue as HttpErrorResponse).error.message).toBe(message);
      expect(auth.estConnecte()).toBe(true);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it("garde l'inscription en cours apres un mauvais code", () => {
      creerService();
      inscrire();
      service.verifier('000000').subscribe({ error: () => undefined });
      http
        .expectOne(`${URL_AUTH}/verification`)
        .flush(erreurServeur(400, 'Code incorrect. Il reste 4 essai(s).'), {
          status: 400,
          statusText: '',
        });

      expect(service.email()).toBe('patient@proxymed.fr');
    });
  });

  describe('estInscriptionAnnulee', () => {
    function erreur(status: number, message: string): HttpErrorResponse {
      return new HttpErrorResponse({ status, error: erreurServeur(status, message) });
    }

    beforeEach(() => creerService());

    it('vrai apres le 5e code faux', () => {
      expect(
        service.estInscriptionAnnulee(
          erreur(
            400,
            "Code incorrect. Nombre maximal d'essais atteint : l'inscription est annulee, veuillez vous inscrire a nouveau.",
          ),
        ),
      ).toBe(true);
    });

    it("vrai quand l'inscription en attente est introuvable (404)", () => {
      expect(service.estInscriptionAnnulee(erreur(404, 'Aucune inscription en attente'))).toBe(
        true,
      );
    });

    it('faux pour un code faux ou expire', () => {
      expect(
        service.estInscriptionAnnulee(erreur(400, 'Code incorrect. Il reste 2 essai(s).')),
      ).toBe(false);
      expect(
        service.estInscriptionAnnulee(erreur(400, 'Le code a expire. Demandez un nouveau code.')),
      ).toBe(false);
    });
  });
});
