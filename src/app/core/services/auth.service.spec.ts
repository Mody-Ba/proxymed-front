import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ConnexionResponse, UtilisateurResponse } from '../models/auth.model';
import { AuthService } from './auth.service';

const URL_AUTH = `${environment.api.auth}/api/auth`;
const CLE_SESSION = 'proxymed.session';

const reponseConnexion: ConnexionResponse = {
  accessToken: 'badge-de-test',
  type: 'Bearer',
  expireDansSecondes: 3600,
  utilisateurId: '11111111-1111-1111-1111-111111111111',
  email: 'senior@proxymed.fr',
  role: 'MEDECIN_SENIOR',
  motDePasseTemporaire: false,
};

const compte: UtilisateurResponse = {
  id: reponseConnexion.utilisateurId,
  email: reponseConnexion.email,
  nomComplet: 'Awa Diallo',
  role: 'MEDECIN_SENIOR',
  actif: true,
  motDePasseTemporaire: false,
  dateCreation: '2026-01-01T00:00:00Z',
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: Router;

  function creerService(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  function seConnecter(reponse: ConnexionResponse = reponseConnexion): void {
    service.connexion({ email: reponse.email, motDePasse: 'secret123' }).subscribe();
    http.expectOne(`${URL_AUTH}/connexion`).flush(reponse);
    http
      .expectOne(`${URL_AUTH}/moi`)
      .flush({ ...compte, motDePasseTemporaire: reponse.motDePasseTemporaire });
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    http?.verify();
    vi.useRealTimers();
  });

  it('se connecte, garde le badge dans sessionStorage et charge le compte', () => {
    creerService();
    seConnecter();

    expect(service.estConnecte()).toBe(true);
    expect(service.role()).toBe('MEDECIN_SENIOR');
    expect(service.badge()).toBe('badge-de-test');
    expect(service.nomAffiche()).toBe('Awa Diallo');
    expect(service.urlAccueil()).toBe('/senior');
    expect(sessionStorage.getItem(CLE_SESSION)).toContain('badge-de-test');
  });

  it("n'ecrit jamais le badge dans localStorage", () => {
    creerService();
    seConnecter();

    expect(localStorage.length).toBe(0);
  });

  it('envoie email et motDePasse a /api/auth/connexion', () => {
    creerService();
    service
      .connexion({ email: 'a@b.fr', motDePasse: 'secret123' })
      .subscribe({ error: () => undefined });

    const requete = http.expectOne(`${URL_AUTH}/connexion`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ email: 'a@b.fr', motDePasse: 'secret123' });
    requete.flush(
      {
        horodatage: '',
        status: 401,
        erreur: 'Authentification echouee',
        message: 'Identifiants invalides',
        details: [],
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(service.estConnecte()).toBe(false);
  });

  it('dirige un mot de passe temporaire vers /changer-mot-de-passe', () => {
    creerService();
    seConnecter({ ...reponseConnexion, motDePasseTemporaire: true });

    expect(service.motDePasseTemporaire()).toBe(true);
    expect(service.urlAccueil()).toBe('/changer-mot-de-passe');
  });

  it('leve le mot de passe temporaire apres le changement (204)', () => {
    creerService();
    seConnecter({ ...reponseConnexion, motDePasseTemporaire: true });

    service
      .changerMotDePasse({ ancienMotDePasse: 'temporaire', nouveauMotDePasse: 'nouveau-secret' })
      .subscribe();
    const requete = http.expectOne(`${URL_AUTH}/changer-mot-de-passe`);
    expect(requete.request.body).toEqual({
      ancienMotDePasse: 'temporaire',
      nouveauMotDePasse: 'nouveau-secret',
    });
    requete.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.motDePasseTemporaire()).toBe(false);
    expect(service.urlAccueil()).toBe('/senior');
  });

  it('se deconnecte : efface la session et renvoie vers /connexion', () => {
    creerService();
    seConnecter();

    service.deconnexion();

    expect(service.estConnecte()).toBe(false);
    expect(service.compte()).toBeNull();
    expect(sessionStorage.getItem(CLE_SESSION)).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/connexion');
  });

  it("se deconnecte automatiquement a l'expiration du badge", () => {
    vi.useFakeTimers();
    creerService();
    seConnecter({ ...reponseConnexion, expireDansSecondes: 60 });

    vi.advanceTimersByTime(59_000);
    expect(service.estConnecte()).toBe(true);

    vi.advanceTimersByTime(1_000);
    expect(service.estConnecte()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/connexion');
    expect(service.consommerMessageConnexion()).toContain('expiré');
  });

  it('restaure une session valide apres un rechargement', () => {
    sessionStorage.setItem(
      CLE_SESSION,
      JSON.stringify({
        badge: 'b',
        role: 'ADMIN',
        email: 'x@y.fr',
        expireLe: Date.now() + 60_000,
        motDePasseTemporaire: false,
      }),
    );
    creerService();

    expect(service.estConnecte()).toBe(true);
    expect(service.urlAccueil()).toBe('/admin');
  });

  it('ignore une session deja expiree', () => {
    sessionStorage.setItem(
      CLE_SESSION,
      JSON.stringify({
        badge: 'b',
        role: 'ADMIN',
        email: 'x@y.fr',
        expireLe: Date.now() - 1,
        motDePasseTemporaire: false,
      }),
    );
    creerService();

    expect(service.estConnecte()).toBe(false);
    expect(sessionStorage.getItem(CLE_SESSION)).toBeNull();
  });
});
