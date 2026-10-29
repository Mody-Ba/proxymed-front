import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Role } from '../../core/models/role.model';
import { AuthService } from '../../core/services/auth.service';

describe('Routes /admin', () => {
  function connecter(role: Role): void {
    sessionStorage.setItem(
      'proxymed.session',
      JSON.stringify({
        badge: 'badge',
        role,
        email: 'admin@proxymed.fr',
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

  it("l'accueil de l'admin a ses deux entrees, le rappel, et aucun lien medical", async () => {
    connecter('ADMIN');
    expect(TestBed.inject(AuthService).urlAccueil()).toBe('/admin');

    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/admin');
    const element = harnais.routeNativeElement!;

    expect(element.querySelector('h1')!.textContent).toContain('Bienvenue, admin@proxymed.fr');
    expect(element.querySelector('a[href="/admin/comptes"]')!.textContent).toContain(
      'Gérer les comptes',
    );
    expect(element.querySelector('a[href="/admin/comptes/nouveau"]')!.textContent).toContain(
      'Créer un médecin',
    );
    expect(element.textContent).toContain("n'a jamais accès aux demandes de consultation");
    const liens = Array.from(element.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(liens.every((l) => l!.startsWith('/admin'))).toBe(true);
  });

  it.each([
    ['MEDECIN_SENIOR', '/admin'],
    ['MEDECIN_JUNIOR', '/admin/comptes'],
    ['UTILISATEUR', '/admin/comptes/nouveau'],
  ] as const)('le role %s qui ouvre %s est renvoye vers /acces-refuse', async (role, url) => {
    connecter(role);
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl(url);

    expect(TestBed.inject(Router).url).toBe('/acces-refuse');
  });

  it('sans connexion, /admin/comptes renvoie vers /connexion', async () => {
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/admin/comptes');

    expect(TestBed.inject(Router).url).toBe('/connexion');
  });
});
