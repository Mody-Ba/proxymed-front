import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { InscriptionService } from '../../../core/services/inscription.service';
import { Inscription } from './inscription';

const URL_INSCRIPTION = `${environment.api.auth}/api/auth/inscription`;

describe('Inscription', () => {
  let fixture: ComponentFixture<Inscription>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function saisir(nom: string, valeur: string): void {
    const champ = element.querySelector<HTMLInputElement>(`input[formcontrolname="${nom}"]`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new Event('blur'));
  }

  function remplir(valeurs: Partial<Record<string, string>> = {}): void {
    const complet = {
      nomComplet: 'Awa Diallo',
      email: 'patient@proxymed.fr',
      motDePasse: 'secret123',
      confirmation: 'secret123',
      ...valeurs,
    };
    for (const [nom, valeur] of Object.entries(complet)) {
      saisir(nom, valeur ?? '');
    }
  }

  async function soumettre(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function texte(): string {
    return element.textContent ?? '';
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Inscription],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Inscription);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it("n'envoie rien et signale les champs obligatoires", async () => {
    await soumettre();

    http.expectNone(URL_INSCRIPTION);
    expect(texte()).toContain('Le nom complet est obligatoire.');
    expect(texte()).toContain("L'adresse e-mail est obligatoire.");
    expect(texte()).toContain('Le mot de passe est obligatoire.');
    expect(texte()).toContain('La confirmation est obligatoire.');
  });

  it('refuse un nom fait seulement d’espaces', async () => {
    remplir({ nomComplet: '   ' });
    await soumettre();

    http.expectNone(URL_INSCRIPTION);
    expect(texte()).toContain('Le nom complet est obligatoire.');
  });

  it('refuse un email invalide', async () => {
    remplir({ email: 'pas-un-email' });
    await soumettre();

    http.expectNone(URL_INSCRIPTION);
    expect(texte()).toContain("L'adresse e-mail n'est pas valide.");
  });

  it.each([
    ['trop court', 'a'.repeat(7)],
    ['trop long', 'a'.repeat(73)],
  ])('refuse un mot de passe %s', async (_cas, motDePasse) => {
    remplir({ motDePasse, confirmation: motDePasse });
    await soumettre();

    http.expectNone(URL_INSCRIPTION);
    expect(texte()).toContain('Le mot de passe doit contenir entre 8 et 72 caractères.');
  });

  it('accepte 8 et 72 caracteres', () => {
    for (const motDePasse of ['a'.repeat(8), 'a'.repeat(72)]) {
      remplir({ motDePasse, confirmation: motDePasse });
      fixture.detectChanges();
      expect(element.querySelector('form')!.classList).toContain('ng-valid');
    }
  });

  it('refuse une confirmation differente', async () => {
    remplir({ confirmation: 'autre-chose' });
    await soumettre();

    http.expectNone(URL_INSCRIPTION);
    expect(texte()).toContain('La confirmation ne correspond pas au mot de passe.');
  });

  it('affiche et masque le mot de passe', () => {
    const champ = () =>
      element.querySelector<HTMLInputElement>('input[formcontrolname="motDePasse"]')!;
    const bouton = element.querySelector<HTMLButtonElement>('.bouton-visibilite')!;
    expect(champ().type).toBe('password');

    bouton.click();
    fixture.detectChanges();
    expect(champ().type).toBe('text');
    expect(bouton.textContent).toContain('Masquer');

    bouton.click();
    fixture.detectChanges();
    expect(champ().type).toBe('password');
  });

  it('envoie le formulaire, vide le mot de passe et ouvre /verification', async () => {
    remplir({ nomComplet: '  Awa Diallo  ' });
    await soumettre();

    const requete = http.expectOne(URL_INSCRIPTION);
    expect(requete.request.body).toEqual({
      nomComplet: 'Awa Diallo',
      email: 'patient@proxymed.fr',
      motDePasse: 'secret123',
    });
    expect(element.querySelector('mat-spinner')).not.toBeNull();

    requete.flush(
      {
        message: 'Un code de verification a ete envoye a patient@proxymed.fr',
        email: 'patient@proxymed.fr',
        codeExpireLe: '',
        renvoiPossibleLe: '',
      },
      { status: 202, statusText: 'Accepted' },
    );
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
    expect(TestBed.inject(InscriptionService).email()).toBe('patient@proxymed.fr');
    expect(
      element.querySelector<HTMLInputElement>('input[formcontrolname="motDePasse"]')!.value,
    ).toBe('');
  });

  it.each([
    [409, 'Un compte existe deja avec cet email'],
    [429, "Un code vient d'etre envoye. Reessayez dans 30 seconde(s)."],
    [503, "L'email n'a pas pu etre envoye. Reessayez plus tard."],
  ])('affiche le message du serveur (%i) et oublie le mot de passe', async (status, message) => {
    remplir();
    await soumettre();

    http
      .expectOne(URL_INSCRIPTION)
      .flush(
        { horodatage: '', status, erreur: 'Erreur', message, details: [] },
        { status, statusText: '' },
      );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(message);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(
      element.querySelector<HTMLInputElement>('input[formcontrolname="motDePasse"]')!.value,
    ).toBe('');
    expect(TestBed.inject(InscriptionService).enCours()).toBeNull();
  });

  it('propose le lien vers la connexion', () => {
    expect(element.querySelector('a[href="/connexion"]')).not.toBeNull();
  });
});
