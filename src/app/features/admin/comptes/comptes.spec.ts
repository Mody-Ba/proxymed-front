import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatChipListboxHarness } from '@angular/material/chips/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { UtilisateurResponse } from '../../../core/models/auth.model';
import { PageContenuResponse } from '../../../core/models/page.model';
import { Role } from '../../../core/models/role.model';
import { AdminUtilisateurService } from '../../../core/services/admin-utilisateur.service';
import { AuthService } from '../../../core/services/auth.service';
import { MESSAGE_ENVOI_IMPOSSIBLE } from '../dialogue-action-compte/dialogue-action-compte';
import { Comptes, EXPLICATION_PROPRE_COMPTE } from './comptes';

const URL_COMPTES = `${environment.api.auth}/api/admin/utilisateurs`;
const URL_MOI = `${environment.api.auth}/api/auth/moi`;
const MON_ID = 'admin-moi';

function compte(
  id: string,
  role: Role = 'MEDECIN_JUNIOR',
  autres: Partial<UtilisateurResponse> = {},
): UtilisateurResponse {
  return {
    id,
    email: `${id}@proxymed.fr`,
    nomComplet: `Compte ${id}`,
    role,
    actif: true,
    motDePasseTemporaire: false,
    dateCreation: '2026-10-28T10:00:00Z',
    ...autres,
  };
}

function page(
  contenu: UtilisateurResponse[],
  totalElements = contenu.length,
  numero = 0,
): PageContenuResponse<UtilisateurResponse> {
  return { contenu, page: numero, taille: 20, totalElements, totalPages: 1 };
}

describe('Comptes', () => {
  let fixture: ComponentFixture<Comptes>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let harnais: HarnessLoader;
  let router: Router;

  async function stabiliser(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function ouvrir(): void {
    fixture = TestBed.createComponent(Comptes);
    element = fixture.nativeElement as HTMLElement;
    harnais = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  /** Repond a la requete de liste en cours et renvoie ses parametres. */
  async function repondre(
    reponse: PageContenuResponse<UtilisateurResponse>,
  ): Promise<URLSearchParams> {
    const requete = http.expectOne((r) => r.url === URL_COMPTES && r.method === 'GET');
    requete.flush(reponse);
    await stabiliser();
    return new URLSearchParams(requete.request.params.toString());
  }

  function lignes(): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('tr.mat-mdc-row'));
  }

  function dialogue(): HTMLElement | null {
    return document.querySelector<HTMLElement>('mat-dialog-container');
  }

  function bouton(libelle: string, racine: ParentNode): HTMLButtonElement | undefined {
    return Array.from(racine.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === libelle,
    );
  }

  async function cliquer(b: HTMLElement | null | undefined): Promise<void> {
    expect(b).toBeTruthy();
    b!.click();
    await stabiliser();
  }

  async function choisir(libelle: string): Promise<void> {
    const liste = await harnais.getHarness(MatChipListboxHarness);
    await liste.selectChips({ text: libelle });
  }

  beforeEach(async () => {
    sessionStorage.clear();
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
    await TestBed.configureTestingModule({
      imports: [Comptes],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);

    // Compte connecte, connu par GET /api/auth/moi.
    TestBed.inject(AuthService).chargerCompte().subscribe();
    http.expectOne(URL_MOI).flush(compte(MON_ID, 'ADMIN', { nomComplet: 'Admin Moi' }));
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
    sessionStorage.clear();
  });

  it('charge tous les comptes par defaut et propose 5 filtres de role', async () => {
    ouvrir();
    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    const params = await repondre(page([compte('a')]));

    expect(params.has('role')).toBe(false);
    expect(params.get('page')).toBe('0');
    expect(params.get('taille')).toBe('20');
    const liste = await harnais.getHarness(MatChipListboxHarness);
    const chips = await liste.getChips();
    expect(await Promise.all(chips.map((c) => c.getText()))).toEqual([
      'Tous',
      'Médecins juniors',
      'Médecins seniors',
      'Patients',
      'Administrateurs',
    ]);
    const [actif] = await liste.getChips({ selected: true });
    expect(await actif.getText()).toBe('Tous');
  });

  it.each([
    ['Médecins juniors', 'MEDECIN_JUNIOR'],
    ['Médecins seniors', 'MEDECIN_SENIOR'],
    ['Patients', 'UTILISATEUR'],
    ['Administrateurs', 'ADMIN'],
  ])('le filtre "%s" envoie role=%s et revient a la premiere page', async (libelle, role) => {
    ouvrir();
    await repondre(page([compte('a')], 45));
    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    expect((await repondre(page([compte('b')], 45, 1))).get('page')).toBe('1');

    await choisir(libelle);
    const params = await repondre(page([compte('c', role as Role)]));
    expect(params.get('role')).toBe(role);
    expect(params.get('page')).toBe('0');
  });

  it('affiche nom, courriel, role en francais, etat et mot de passe temporaire', async () => {
    ouvrir();
    await repondre(
      page([
        compte('a', 'MEDECIN_SENIOR', { motDePasseTemporaire: true }),
        compte('b', 'UTILISATEUR', { actif: false }),
      ]),
    );

    const [l1, l2] = lignes();
    expect(l1.querySelector('.cellule-nom')!.textContent).toContain('Compte a');
    expect(l1.querySelector('.cellule-email')!.textContent!.trim()).toBe('a@proxymed.fr');
    expect(l1.querySelector('.cellule-role')!.textContent!.trim()).toBe('Médecin senior');
    expect(l2.querySelector('.cellule-role')!.textContent!.trim()).toBe('Patient ou proche');

    const etat1 = l1.querySelector('app-etat-compte span')!;
    const etat2 = l2.querySelector('app-etat-compte span')!;
    expect(etat1.textContent!.trim()).toBe('Actif');
    expect(etat1.classList).toContain('etat-actif');
    expect(etat2.textContent!.trim()).toBe('Désactivé');
    expect(etat2.classList).toContain('etat-desactive');
    expect(etat2.querySelector('mat-icon')!.getAttribute('aria-hidden')).toBe('true');

    expect(l1.querySelector('.cellule-temporaire')!.textContent!.trim()).toBe('Oui');
    expect(l2.querySelector('.cellule-temporaire')!.textContent!.trim()).toBe('Non');
    expect(l1.querySelector('.cellule-temporaire mat-icon')).not.toBeNull();
  });

  it('les boutons-icones portent un aria-label en francais avec le nom du compte', async () => {
    ouvrir();
    await repondre(page([compte('a'), compte('b', 'MEDECIN_JUNIOR', { actif: false })]));

    const [l1, l2] = lignes();
    expect(l1.querySelector('.action-activation')!.getAttribute('aria-label')).toBe(
      'Désactiver le compte de Compte a',
    );
    expect(l2.querySelector('.action-activation')!.getAttribute('aria-label')).toBe(
      'Activer le compte de Compte b',
    );
    expect(l1.querySelector('.action-reinitialisation')!.getAttribute('aria-label')).toBe(
      'Réinitialiser le mot de passe de Compte a',
    );
    for (const icone of Array.from(element.querySelectorAll('.cellule-actions mat-icon'))) {
      expect(icone.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('sur son propre compte, "Désactiver" est inactif et explique pourquoi', async () => {
    ouvrir();
    await repondre(page([compte(MON_ID, 'ADMIN', { nomComplet: 'Admin Moi' }), compte('a')]));

    const [moi, autre] = lignes();
    const bloque = moi.querySelector<HTMLButtonElement>('.action-activation')!;
    expect(bloque.getAttribute('aria-disabled')).toBe('true');
    expect(bloque.getAttribute('aria-label')).toContain('impossible, c’est votre compte');
    expect(moi.textContent).toContain(EXPLICATION_PROPRE_COMPTE);
    expect(autre.textContent).not.toContain(EXPLICATION_PROPRE_COMPTE);
    expect(autre.querySelector('.action-activation')!.getAttribute('aria-disabled')).not.toBe(
      'true',
    );

    await cliquer(bloque);
    expect(dialogue()).toBeNull();
    // La reinitialisation de son propre mot de passe reste possible.
    expect(moi.querySelector<HTMLButtonElement>('.action-reinitialisation')!.disabled).toBe(false);
  });

  describe('Desactiver / activer', () => {
    it('confirme en rappelant le nom, envoie { actif: false } et rafraichit', async () => {
      ouvrir();
      await repondre(page([compte('a')]));

      await cliquer(lignes()[0].querySelector<HTMLButtonElement>('.action-activation'));
      expect(dialogue()!.getAttribute('role')).toBe('dialog');
      expect(dialogue()!.querySelector('h2')!.textContent).toContain('Désactiver le compte ?');
      expect(dialogue()!.textContent).toContain('Compte a');
      expect(dialogue()!.textContent).toContain('ne pourra plus se connecter');

      await cliquer(bouton('Désactiver', dialogue()!));
      const requete = http.expectOne(`${URL_COMPTES}/a/activation`);
      expect(requete.request.method).toBe('PATCH');
      expect(requete.request.body).toEqual({ actif: false });
      requete.flush(compte('a', 'MEDECIN_JUNIOR', { actif: false }));
      await stabiliser();

      await repondre(page([compte('a', 'MEDECIN_JUNIOR', { actif: false })]));
      expect(dialogue()).toBeNull();
      expect(element.querySelector('[role="status"]')!.textContent).toContain(
        'Le compte de Compte a a été désactivé',
      );
      expect(lignes()[0].querySelector('app-etat-compte')!.textContent!.trim()).toBe('Désactivé');
    });

    it('reactive un compte desactive avec { actif: true }', async () => {
      ouvrir();
      await repondre(page([compte('b', 'MEDECIN_SENIOR', { actif: false })]));

      await cliquer(lignes()[0].querySelector<HTMLButtonElement>('.action-activation'));
      expect(dialogue()!.querySelector('h2')!.textContent).toContain('Activer le compte ?');
      await cliquer(bouton('Activer', dialogue()!));

      const requete = http.expectOne(`${URL_COMPTES}/b/activation`);
      expect(requete.request.body).toEqual({ actif: true });
      requete.flush(compte('b', 'MEDECIN_SENIOR'));
      await stabiliser();
      await repondre(page([compte('b', 'MEDECIN_SENIOR')]));
      expect(element.querySelector('[role="status"]')!.textContent).toContain('a été activé');
    });

    it('Annuler ne fait aucun appel', async () => {
      ouvrir();
      await repondre(page([compte('a')]));

      await cliquer(lignes()[0].querySelector<HTMLButtonElement>('.action-activation'));
      await cliquer(bouton('Annuler', dialogue()!));

      expect(dialogue()).toBeNull();
      http.expectNone(`${URL_COMPTES}/a/activation`);
    });

    it('un refus du serveur (400) reste affiche dans le dialogue', async () => {
      ouvrir();
      await repondre(page([compte('a')]));
      await cliquer(lignes()[0].querySelector<HTMLButtonElement>('.action-activation'));
      await cliquer(bouton('Désactiver', dialogue()!));

      http.expectOne(`${URL_COMPTES}/a/activation`).flush(
        {
          horodatage: '',
          status: 400,
          erreur: 'Regle de gestion non respectee',
          message: 'Un administrateur ne peut pas desactiver son propre compte',
          details: [],
        },
        { status: 400, statusText: '' },
      );
      await stabiliser();

      expect(dialogue()!.querySelector('[role="alert"]')!.textContent).toContain(
        'ne peut pas desactiver son propre compte',
      );
    });
  });

  describe('Reinitialiser le mot de passe', () => {
    it('confirme, envoie la demande et annonce l’envoi du courriel', async () => {
      ouvrir();
      await repondre(page([compte('a', 'MEDECIN_JUNIOR', { motDePasseTemporaire: false })]));

      await cliquer(lignes()[0].querySelector<HTMLButtonElement>('.action-reinitialisation'));
      expect(dialogue()!.querySelector('h2')!.textContent).toContain(
        'Réinitialiser le mot de passe ?',
      );
      expect(dialogue()!.textContent).toContain('Compte a');
      await cliquer(bouton('Réinitialiser', dialogue()!));

      const requete = http.expectOne(`${URL_COMPTES}/a/reinitialiser-mot-de-passe`);
      expect(requete.request.method).toBe('POST');
      expect(requete.request.body).toBeNull();
      requete.flush(compte('a', 'MEDECIN_JUNIOR', { motDePasseTemporaire: true }));
      await stabiliser();
      await repondre(page([compte('a', 'MEDECIN_JUNIOR', { motDePasseTemporaire: true })]));

      expect(element.querySelector('[role="status"]')!.textContent).toContain(
        'Un nouveau mot de passe temporaire a été envoyé par courriel',
      );
      expect(lignes()[0].querySelector('.cellule-temporaire')!.textContent!.trim()).toBe('Oui');
      expect(element.textContent!.toLowerCase()).not.toContain('mot de passe :');
    });

    it('sur 503 : dit clairement que le courriel n’est pas parti', async () => {
      ouvrir();
      await repondre(page([compte('a')]));
      await cliquer(lignes()[0].querySelector<HTMLButtonElement>('.action-reinitialisation'));
      await cliquer(bouton('Réinitialiser', dialogue()!));

      http.expectOne(`${URL_COMPTES}/a/reinitialiser-mot-de-passe`).flush(
        {
          horodatage: '',
          status: 503,
          erreur: "Envoi d'email impossible",
          message: "L'email n'a pas pu etre envoye. Reessayez plus tard.",
          details: [],
        },
        { status: 503, statusText: '' },
      );
      await stabiliser();

      expect(dialogue()).not.toBeNull();
      expect(dialogue()!.querySelector('[role="alert"]')!.textContent!.trim()).toBe(
        MESSAGE_ENVOI_IMPOSSIBLE,
      );
      expect(bouton('Réinitialiser', dialogue()!)!.disabled).toBe(false);
      http.expectNone((r) => r.url === URL_COMPTES && r.method === 'GET');
    });
  });

  it('affiche un etat vide propre au filtre', async () => {
    ouvrir();
    await repondre(page([]));
    expect(element.textContent).toContain('Aucun compte pour le moment.');
    expect(element.querySelector('table')).toBeNull();

    await choisir('Médecins seniors');
    await repondre(page([]));
    expect(element.textContent).toContain('Aucun compte de médecin senior.');
  });

  it('affiche une erreur lisible et permet de reessayer', async () => {
    ouvrir();
    http
      .expectOne((r) => r.url === URL_COMPTES)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await stabiliser();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Les comptes n’ont pas pu être chargés.',
    );
    await cliquer(element.querySelector<HTMLButtonElement>('.reessayer'));
    await repondre(page([]));
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('affiche le message laisse par la creation d’un compte', async () => {
    TestBed.inject(AdminUtilisateurService).annoncerSurListe('Le compte a été créé.');
    ouvrir();
    await repondre(page([]));

    expect(element.querySelector('[role="status"]')!.textContent).toContain(
      'Le compte a été créé.',
    );
  });
});
