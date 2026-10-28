import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { AuthService } from '../../../core/services/auth.service';
import { InscriptionService } from '../../../core/services/inscription.service';
import { MESSAGE_COMPTE_CREE, Verification } from './verification';

const URL_AUTH = `${environment.api.auth}/api/auth`;
const EMAIL = 'patient@proxymed.fr';

const enAttente = {
  message: `Un code de verification a ete envoye a ${EMAIL}`,
  email: EMAIL,
  codeExpireLe: '',
  renvoiPossibleLe: '',
};

function erreurServeur(status: number, message: string) {
  return { horodatage: '', status, erreur: 'Erreur', message, details: [] };
}

describe('Verification', () => {
  let fixture: ComponentFixture<Verification>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  let inscription: InscriptionService;

  function configurer(): void {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Verification],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    inscription = TestBed.inject(InscriptionService);
  }

  /** Inscription reussie (202), puis ouverture de la page. */
  function ouvrirApresInscription(): void {
    inscription
      .inscrire({ nomComplet: 'Awa Diallo', email: EMAIL, motDePasse: 'secret123' })
      .subscribe();
    http.expectOne(`${URL_AUTH}/inscription`).flush(enAttente, { status: 202, statusText: '' });
    fixture = TestBed.createComponent(Verification);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function saisirCode(code: string): void {
    const champ = element.querySelector<HTMLInputElement>('input[formcontrolname="code"]')!;
    champ.value = code;
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new Event('blur'));
  }

  function valider(): void {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  }

  function boutonRenvoi(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.bouton-renvoi')!;
  }

  function texte(): string {
    return element.textContent ?? '';
  }

  /** Avance l'horloge et le setInterval du compte a rebours. */
  function avancer(secondes: number): void {
    vi.advanceTimersByTime(secondes * 1000);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    configurer();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it("affiche l'adresse, la validite de 10 minutes et un champ de code a usage unique", () => {
    ouvrirApresInscription();

    expect(element.querySelector('.email')!.textContent).toBe(EMAIL);
    expect(texte()).toContain('valable 10 minutes');
    const champ = element.querySelector<HTMLInputElement>('input[formcontrolname="code"]')!;
    expect(champ.getAttribute('autocomplete')).toBe('one-time-code');
    expect(champ.getAttribute('inputmode')).toBe('numeric');
  });

  describe('validation du code', () => {
    beforeEach(() => ouvrirApresInscription());

    it('exige un code', () => {
      valider();
      http.expectNone(`${URL_AUTH}/verification`);
      expect(texte()).toContain('Le code est obligatoire.');
    });

    it.each(['12345', '1234567', 'abcdef', '12 456'])('refuse %s', (code) => {
      saisirCode(code);
      valider();
      http.expectNone(`${URL_AUTH}/verification`);
      expect(texte()).toContain('Le code doit contenir exactement 6 chiffres.');
    });
  });

  describe('compte a rebours du renvoi', () => {
    beforeEach(() => ouvrirApresInscription());

    it('desactive le bouton pendant 60 secondes en affichant le temps restant', () => {
      expect(boutonRenvoi().disabled).toBe(true);
      expect(texte()).toContain('Nouveau code possible dans 60 s.');

      avancer(15);
      expect(texte()).toContain('Nouveau code possible dans 45 s.');
      expect(boutonRenvoi().disabled).toBe(true);

      avancer(45);
      expect(boutonRenvoi().disabled).toBe(false);
      expect(element.querySelector('.compte-a-rebours')).toBeNull();
    });

    it('apres un renvoi reussi : message du serveur et nouveau compte a rebours', () => {
      avancer(60);
      boutonRenvoi().click();

      const requete = http.expectOne(`${URL_AUTH}/renvoyer-code`);
      expect(requete.request.body).toEqual({ email: EMAIL });
      requete.flush(enAttente);
      fixture.detectChanges();

      expect(texte()).toContain(enAttente.message);
      expect(boutonRenvoi().disabled).toBe(true);
      expect(texte()).toContain('Nouveau code possible dans 60 s.');
    });

    it('sur 429 : affiche le message et repart de Retry-After', () => {
      avancer(60);
      boutonRenvoi().click();

      const message = "Un code vient d'etre envoye. Reessayez dans 20 seconde(s).";
      http.expectOne(`${URL_AUTH}/renvoyer-code`).flush(erreurServeur(429, message), {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '20' },
      });
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')!.textContent).toContain(message);
      expect(texte()).toContain('Nouveau code possible dans 20 s.');
      expect(boutonRenvoi().disabled).toBe(true);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('sur 503 : affiche le message sans quitter la page', () => {
      avancer(60);
      boutonRenvoi().click();

      const message = "L'email n'a pas pu etre envoye. Reessayez plus tard.";
      http
        .expectOne(`${URL_AUTH}/renvoyer-code`)
        .flush(erreurServeur(503, message), { status: 503, statusText: '' });
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')!.textContent).toContain(message);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  it('apres un code correct : /connexion avec le message de succes', () => {
    ouvrirApresInscription();
    saisirCode('123456');
    valider();

    const requete = http.expectOne(`${URL_AUTH}/verification`);
    expect(requete.request.body).toEqual({ email: EMAIL, code: '123456' });
    requete.flush({ id: '1', email: EMAIL }, { status: 201, statusText: 'Created' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/connexion');
    expect(TestBed.inject(AuthService).consommerMessageConnexion()).toBe(MESSAGE_COMPTE_CREE);
    expect(inscription.enCours()).toBeNull();
  });

  it('code faux : affiche le message du serveur et reste sur la page', () => {
    ouvrirApresInscription();
    saisirCode('000000');
    valider();

    const message = 'Code incorrect. Il reste 4 essai(s).';
    http
      .expectOne(`${URL_AUTH}/verification`)
      .flush(erreurServeur(400, message), { status: 400, statusText: '' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(message);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(inscription.email()).toBe(EMAIL);
  });

  it.each([
    [
      400,
      "Code incorrect. Nombre maximal d'essais atteint : l'inscription est annulee, veuillez vous inscrire a nouveau.",
    ],
    [404, 'Aucune inscription en attente pour cet email. Veuillez vous inscrire.'],
  ])('inscription annulee (%i) : retour a /inscription avec le message', (status, message) => {
    ouvrirApresInscription();
    saisirCode('000000');
    valider();

    http
      .expectOne(`${URL_AUTH}/verification`)
      .flush(erreurServeur(status, message), { status, statusText: '' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/inscription');
    expect(inscription.enCours()).toBeNull();
    expect(inscription.consommerMessageInscription()).toBe(message);
  });
});

describe('Acces a /verification', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
  });

  it('sans inscription en cours : redirige vers /inscription', async () => {
    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/verification');

    expect(TestBed.inject(Router).url).toBe('/inscription');
  });

  it('pendant une inscription : affiche la page de verification', async () => {
    const inscription = TestBed.inject(InscriptionService);
    inscription
      .inscrire({ nomComplet: 'Awa Diallo', email: EMAIL, motDePasse: 'secret123' })
      .subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(`${URL_AUTH}/inscription`)
      .flush(enAttente, { status: 202, statusText: '' });

    const harnais = await RouterTestingHarness.create();
    await harnais.navigateByUrl('/verification', Verification);

    expect(TestBed.inject(Router).url).toBe('/verification');
  });
});
