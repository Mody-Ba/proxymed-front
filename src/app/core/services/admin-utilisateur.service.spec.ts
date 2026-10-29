import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { UtilisateurResponse } from '../models/auth.model';
import { AdminUtilisateurService } from './admin-utilisateur.service';

const URL_COMPTES = `${environment.api.auth}/api/admin/utilisateurs`;
const ID = '44444444-4444-4444-4444-444444444444';

const compte: UtilisateurResponse = {
  id: ID,
  email: 'aminata.sow@proxymed.fr',
  nomComplet: 'Dr Aminata Sow',
  role: 'MEDECIN_JUNIOR',
  actif: true,
  motDePasseTemporaire: true,
  dateCreation: '2026-10-28T10:00:00Z',
};

/** Un corps qui ne contient aucune trace de mot de passe. */
function sansMotDePasse(corps: unknown): void {
  expect(JSON.stringify(corps ?? null).toLowerCase()).not.toContain('motdepasse"');
  expect(JSON.stringify(corps ?? null).toLowerCase()).not.toContain('password');
}

describe('AdminUtilisateurService', () => {
  let service: AdminUtilisateurService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem(
      'proxymed.session',
      JSON.stringify({
        badge: 'badge-admin',
        role: 'ADMIN',
        email: 'admin@proxymed.fr',
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
    service = TestBed.inject(AdminUtilisateurService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('cree un compte avec seulement nomComplet, email et role, badge joint', () => {
    service
      .creer({ nomComplet: 'Dr Aminata Sow', email: compte.email, role: 'MEDECIN_JUNIOR' })
      .subscribe();

    const requete = http.expectOne(URL_COMPTES);
    expect(requete.request.url).toBe('http://localhost:8083/api/admin/utilisateurs');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer badge-admin');
    expect(requete.request.body).toEqual({
      nomComplet: 'Dr Aminata Sow',
      email: compte.email,
      role: 'MEDECIN_JUNIOR',
    });
    requete.flush(compte, { status: 201, statusText: 'Created' });
  });

  it("n'envoie jamais de mot de passe ni d'autre champ, meme si on lui en passe", () => {
    const tricheur = {
      nomComplet: 'X',
      email: 'x@proxymed.fr',
      role: 'MEDECIN_SENIOR' as const,
      motDePasse: 'secret',
      actif: false,
    };
    service.creer(tricheur).subscribe();

    const corps = http.expectOne(URL_COMPTES).request.body as Record<string, unknown>;
    expect(Object.keys(corps).sort()).toEqual(['email', 'nomComplet', 'role']);
    sansMotDePasse(corps);
  });

  it('liste les comptes avec page et taille, sans role par defaut', () => {
    service.lister(null).subscribe();

    const requete = http.expectOne((r) => r.url === URL_COMPTES);
    expect(requete.request.method).toBe('GET');
    expect(requete.request.urlWithParams).toBe(`${URL_COMPTES}?page=0&taille=20`);
    requete.flush({ contenu: [], page: 0, taille: 20, totalElements: 0, totalPages: 0 });
  });

  it('filtre par role', () => {
    service.lister('MEDECIN_SENIOR', 2, 50).subscribe();

    const requete = http.expectOne((r) => r.url === URL_COMPTES);
    expect(requete.request.urlWithParams).toBe(
      `${URL_COMPTES}?page=2&taille=50&role=MEDECIN_SENIOR`,
    );
    requete.flush({ contenu: [], page: 2, taille: 50, totalElements: 0, totalPages: 0 });
  });

  it("lit le detail d'un compte par son identifiant", () => {
    let recu: UtilisateurResponse | undefined;
    service.findById(ID).subscribe((c) => (recu = c));

    const requete = http.expectOne(`${URL_COMPTES}/${ID}`);
    expect(requete.request.method).toBe('GET');
    requete.flush(compte);
    expect(recu).toEqual(compte);
  });

  it.each([true, false])('change l’activation en envoyant seulement { actif: %s }', (actif) => {
    service.changerActivation(ID, actif).subscribe();

    const requete = http.expectOne(`${URL_COMPTES}/${ID}/activation`);
    expect(requete.request.method).toBe('PATCH');
    expect(requete.request.body).toEqual({ actif });
    requete.flush({ ...compte, actif });
  });

  it('reinitialise le mot de passe sans aucun corps', () => {
    service.reinitialiserMotDePasse(ID).subscribe();

    const requete = http.expectOne(`${URL_COMPTES}/${ID}/reinitialiser-mot-de-passe`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toBeNull();
    requete.flush(compte);
  });

  it('laisse remonter le 503 a la page, sans redirection ni deconnexion', () => {
    let erreur: unknown;
    service.reinitialiserMotDePasse(ID).subscribe({ error: (e: unknown) => (erreur = e) });

    http.expectOne(`${URL_COMPTES}/${ID}/reinitialiser-mot-de-passe`).flush(
      {
        horodatage: '',
        status: 503,
        erreur: "Envoi d'email impossible",
        message: '',
        details: [],
      },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect((erreur as HttpErrorResponse).status).toBe(503);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('proxymed.session')).not.toBeNull();
  });

  it('ne garde ni nom ni courriel dans le stockage ni dans la console', () => {
    const journal = (['log', 'info', 'debug', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    service
      .creer({ nomComplet: compte.nomComplet, email: compte.email, role: 'MEDECIN_JUNIOR' })
      .subscribe();
    http.expectOne(URL_COMPTES).flush(compte, { status: 201, statusText: '' });
    service.lister(null).subscribe();
    http
      .expectOne((r) => r.url === URL_COMPTES)
      .flush({ contenu: [compte], page: 0, taille: 20, totalElements: 1, totalPages: 1 });

    const stockage = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stockage).not.toContain(compte.nomComplet);
    expect(stockage).not.toContain(compte.email);
    for (const espion of journal) {
      expect(espion).not.toHaveBeenCalled();
    }
  });

  it('transmet le message de creation une seule fois a la liste', () => {
    service.annoncerSurListe('Le compte a été créé.');
    expect(service.consommerMessageListe()).toBe('Le compte a été créé.');
    expect(service.consommerMessageListe()).toBeNull();
  });
});
