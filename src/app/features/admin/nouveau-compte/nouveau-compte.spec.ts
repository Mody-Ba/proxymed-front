import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { UtilisateurResponse } from '../../../core/models/auth.model';
import { AdminUtilisateurService } from '../../../core/services/admin-utilisateur.service';
import {
  MESSAGE_COURRIEL_UTILISE,
  MESSAGE_ENVOI_ECHOUE,
  messageCompteCree,
  NouveauCompte,
} from './nouveau-compte';

const URL_COMPTES = `${environment.api.auth}/api/admin/utilisateurs`;

const cree: UtilisateurResponse = {
  id: 'nouveau',
  email: 'ibrahima.fall@proxymed.fr',
  nomComplet: 'Dr Ibrahima Fall',
  role: 'MEDECIN_SENIOR',
  actif: true,
  motDePasseTemporaire: true,
  dateCreation: '2026-10-29T08:00:00Z',
};

function erreur(status: number, message: string, details: string[] = []) {
  return [
    { horodatage: '', status, erreur: 'Erreur', message, details },
    { status, statusText: '' },
  ] as const;
}

describe('NouveauCompte', () => {
  let fixture: ComponentFixture<NouveauCompte>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function ouvrir(): void {
    fixture = TestBed.createComponent(NouveauCompte);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function saisir(nom: string, valeur: string): void {
    const champ = element.querySelector<HTMLInputElement>(`input[formcontrolname="${nom}"]`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function choisirRole(libelle: string): void {
    const radio = Array.from(element.querySelectorAll('mat-radio-button')).find((r) =>
      r.textContent!.includes(libelle),
    )!;
    radio.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
    fixture.detectChanges();
  }

  function remplir(): void {
    saisir('nomComplet', '  Dr Ibrahima Fall ');
    saisir('email', 'ibrahima.fall@proxymed.fr');
    choisirRole('Médecin senior');
  }

  function envoyer(): void {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  }

  function erreurs(): string {
    return Array.from(element.querySelectorAll('mat-error, .erreur-role'))
      .map((e) => e.textContent!.trim())
      .join(' | ');
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NouveauCompte],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ne propose que medecin junior et medecin senior, et aucun champ mot de passe', () => {
    ouvrir();

    const roles = Array.from(element.querySelectorAll('mat-radio-button')).map((r) =>
      r.textContent!.trim(),
    );
    expect(roles).toEqual(['Médecin junior', 'Médecin senior']);
    expect(element.querySelector('input[type="password"]')).toBeNull();
  });

  it('les trois champs sont obligatoires', () => {
    ouvrir();
    envoyer();

    http.expectNone(URL_COMPTES);
    expect(erreurs()).toContain('Le nom complet est obligatoire.');
    expect(erreurs()).toContain('Le courriel est obligatoire.');
    expect(erreurs()).toContain('Choisissez le rôle du médecin.');
  });

  it('verifie le format du courriel et les longueurs du serveur (255)', () => {
    ouvrir();
    saisir('email', 'pas-un-courriel');
    expect(erreurs()).toContain("Le courriel n'est pas valide.");

    saisir('nomComplet', 'x'.repeat(256));
    expect(erreurs()).toContain('Le nom complet ne doit pas dépasser 255 caractères.');

    // Plus de 255 caracteres : Validators.email (254 au plus) le refuse deja comme invalide.
    saisir('email', `${'a'.repeat(60)}@${`${'b'.repeat(60)}.`.repeat(4)}fr`);
    expect(erreurs()).toContain("Le courriel n'est pas valide.");

    choisirRole('Médecin junior');
    envoyer();
    http.expectNone(URL_COMPTES);
  });

  it('un nom fait seulement d’espaces est refuse', () => {
    ouvrir();
    saisir('nomComplet', '    ');
    expect(erreurs()).toContain('Le nom complet est obligatoire.');
  });

  it('cree le compte, annonce le courriel envoye et revient a la liste', () => {
    ouvrir();
    remplir();
    envoyer();

    expect(element.querySelector('mat-spinner')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    const requete = http.expectOne(URL_COMPTES);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({
      nomComplet: 'Dr Ibrahima Fall',
      email: 'ibrahima.fall@proxymed.fr',
      role: 'MEDECIN_SENIOR',
    });
    requete.flush(cree, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/comptes');
    expect(TestBed.inject(AdminUtilisateurService).consommerMessageListe()).toBe(
      'Le compte a été créé. Un mot de passe temporaire a été envoyé par courriel à ibrahima.fall@proxymed.fr.',
    );
    expect(messageCompteCree(cree.email)).toContain(cree.email);
  });

  it('sur 409 : courriel deja utilise, signale sur le champ', () => {
    ouvrir();
    remplir();
    envoyer();
    http.expectOne(URL_COMPTES).flush(...erreur(409, 'Un compte existe deja avec cet email'));
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      MESSAGE_COURRIEL_UTILISE,
    );
    expect(erreurs()).toContain('Ce courriel est déjà utilisé par un autre compte.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    // Corriger l'adresse efface l'erreur du champ.
    saisir('email', 'autre@proxymed.fr');
    expect(erreurs()).not.toContain('déjà utilisé');
  });

  it('sur 503 : le compte n’a pas ete cree, et l’on peut reessayer', () => {
    ouvrir();
    remplir();
    envoyer();
    http
      .expectOne(URL_COMPTES)
      .flush(...erreur(503, "L'email n'a pas pu etre envoye. Reessayez plus tard."));
    fixture.detectChanges();

    const alerte = element.querySelector('[role="alert"]')!;
    expect(alerte.textContent).toContain(MESSAGE_ENVOI_ECHOUE);
    expect(alerte.textContent).toContain('le compte n’a pas été créé');
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    element.querySelector<HTMLButtonElement>('.reessayer')!.click();
    fixture.detectChanges();
    http.expectOne(URL_COMPTES).flush(cree, { status: 201, statusText: '' });
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/comptes');
  });

  it('sur 400 : message et details du serveur', () => {
    ouvrir();
    remplir();
    envoyer();
    http
      .expectOne(URL_COMPTES)
      .flush(
        ...erreur(400, 'Un ou plusieurs champs sont invalides', [
          "email : l'email n'est pas valide",
        ]),
      );
    fixture.detectChanges();

    const alerte = element.querySelector('[role="alert"]')!;
    expect(alerte.textContent).toContain('Un ou plusieurs champs sont invalides');
    expect(alerte.textContent).toContain("email : l'email n'est pas valide");
    expect(element.querySelector('.reessayer')).toBeNull();
  });

  it('ne garde ni nom ni courriel dans le stockage du navigateur', () => {
    ouvrir();
    remplir();
    envoyer();
    http.expectOne(URL_COMPTES).flush(cree, { status: 201, statusText: '' });

    const stockage = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stockage).not.toContain(cree.email);
    expect(stockage).not.toContain(cree.nomComplet);
  });
});
