import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Role } from '../../core/models/role.model';
import { AuthService } from '../../core/services/auth.service';

const CLE_SESSION = 'proxymed.session';

describe('Routes /patient', () => {
  function connecter(role: Role): void {
    sessionStorage.setItem(
      CLE_SESSION,
      JSON.stringify({
        badge: 'badge',
        role,
        email: 'compte@proxymed.fr',
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

  it("l'accueil d'un patient est /patient, avec ses deux entrees et le parcours", async () => {
    connecter('UTILISATEUR');
    expect(TestBed.inject(AuthService).urlAccueil()).toBe('/patient');

    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/patient');
    const element = harnais.routeNativeElement!;

    expect(element.querySelector('h1')!.textContent).toContain('Bienvenue, compte@proxymed.fr');
    expect(element.querySelector('a[href="/patient/nouvelle-demande"]')).not.toBeNull();
    expect(element.querySelector('a[href="/patient/mes-demandes"]')).not.toBeNull();
    expect(element.textContent).toContain('Un médecin senior étudie votre demande.');
  });

  it.each([
    '/patient',
    '/patient/nouvelle-demande',
    '/patient/mes-demandes',
    '/patient/demandes/x',
  ])('un medecin qui ouvre %s est renvoye vers /acces-refuse', async (url) => {
    connecter('MEDECIN_SENIOR');
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl(url);

    expect(TestBed.inject(Router).url).toBe('/acces-refuse');
  });

  it('sans connexion, /patient/mes-demandes renvoie vers /connexion', async () => {
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/patient/mes-demandes');

    expect(TestBed.inject(Router).url).toBe('/connexion');
  });
});
