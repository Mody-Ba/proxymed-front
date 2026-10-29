import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { Role } from '../core/models/role.model';
import { AuthService } from '../core/services/auth.service';

const CLE_SESSION = 'proxymed.session';

describe('Routes /senior et /junior', () => {
  function connecter(role: Role): void {
    sessionStorage.setItem(
      CLE_SESSION,
      JSON.stringify({
        badge: 'badge',
        role,
        email: 'medecin@proxymed.fr',
        expireLe: Date.now() + 3_600_000,
        motDePasseTemporaire: false,
      }),
    );
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
  });

  afterEach(() => sessionStorage.clear());

  it("l'accueil du senior resume son role et mene aux demandes en attente", async () => {
    connecter('MEDECIN_SENIOR');
    expect(TestBed.inject(AuthService).urlAccueil()).toBe('/senior');

    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/senior');
    const element = harnais.routeNativeElement!;

    expect(element.querySelector('h1')!.textContent).toContain('Bienvenue, medecin@proxymed.fr');
    const lien = element.querySelector('a[href="/senior/demandes"]')!;
    expect(lien.textContent).toContain('Demandes en attente');
    expect(element.textContent).toContain('médecin junior');
  });

  it("l'accueil du junior mene a ses demandes assignees", async () => {
    connecter('MEDECIN_JUNIOR');
    expect(TestBed.inject(AuthService).urlAccueil()).toBe('/junior');

    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/junior');
    const element = harnais.routeNativeElement!;

    expect(element.querySelector('h1')!.textContent).toContain('Bienvenue');
    expect(element.querySelector('a[href="/junior/demandes"]')!.textContent).toContain(
      'Demandes assignées',
    );
  });

  it.each([
    ['MEDECIN_JUNIOR', '/senior'],
    ['MEDECIN_JUNIOR', '/senior/demandes'],
    ['UTILISATEUR', '/senior/demandes/x'],
    ['MEDECIN_SENIOR', '/junior'],
    ['MEDECIN_SENIOR', '/junior/demandes'],
    ['UTILISATEUR', '/junior/demandes/x'],
  ] as const)('le role %s qui ouvre %s est renvoye vers /acces-refuse', async (role, url) => {
    connecter(role);
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl(url);

    expect(TestBed.inject(Router).url).toBe('/acces-refuse');
  });

  it.each(['/senior/demandes', '/junior/demandes'])(
    'sans connexion, %s renvoie vers /connexion',
    async (url) => {
      const harnais = await RouterTestingHarness.create();
      await harnais.navigateByUrl(url);

      expect(TestBed.inject(Router).url).toBe('/connexion');
    },
  );
});
