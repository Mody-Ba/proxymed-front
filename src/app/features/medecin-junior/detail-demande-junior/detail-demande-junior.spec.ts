import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { MedecinFiche1Response } from '../../../core/models/medecin.model';
import {
  MESSAGE_DEMANDE_ACCES_REFUSE,
  MESSAGE_DEMANDE_INTROUVABLE,
} from '../../../core/utils/erreur-http';
import {
  MESSAGE_ACCES_REFUSE_COMMENCEMENT,
  MESSAGE_AUCUN_SENIOR,
} from '../dialogue-commencer-consultation/dialogue-commencer-consultation';
import { DetailDemandeJunior, MESSAGE_CONSULTATION_COMMENCEE } from './detail-demande-junior';

const ID = '33333333-3333-3333-3333-333333333333';
const URL_DETAIL = `${environment.api.fiche1}/api/demandes-consultation/${ID}`;
const URL_COMMENCER = `${URL_DETAIL}/commencer`;
const URL_SENIORS = `${environment.api.fiche1}/api/medecins`;

const assignee: DemandeConsultationResponse = {
  id: ID,
  demandeurId: 'patient',
  nomPatient: 'Fatou Ndiaye',
  pourProche: false,
  motif: 'Douleurs abdominales',
  statut: 'ACCEPTEE',
  medecinSeniorId: 'senior',
  juniorId: 'moi',
  motifRefus: null,
  dateCreation: '2026-10-20T08:15:00Z',
  dateDecision: '2026-10-21T10:00:00Z',
  consultationId: null,
};
const commencee: DemandeConsultationResponse = { ...assignee, consultationId: 'c-1' };

const SENIORS: MedecinFiche1Response[] = [
  {
    id: 7,
    nom: 'Diop',
    prenom: 'Aminata',
    numeroOrdre: 'ONMS-2011-0457',
    role: 'SENIOR',
    structureRattachementId: null,
    structureRattachementLibelle: null,
  },
  {
    id: 9,
    nom: 'Sy',
    prenom: 'Cheikh',
    numeroOrdre: 'ONMS-2015-0101',
    role: 'SENIOR',
    structureRattachementId: null,
    structureRattachementLibelle: null,
  },
];

function erreurServeur(status: number, erreur: string, message: string, details: string[] = []) {
  return [
    { horodatage: '', status, erreur, message, details },
    { status, statusText: '' },
  ] as const;
}

describe('DetailDemandeJunior', () => {
  let fixture: ComponentFixture<DetailDemandeJunior>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  let documentHarnais: HarnessLoader;

  async function stabiliser(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(demande: DemandeConsultationResponse = assignee): Promise<void> {
    fixture = TestBed.createComponent(DetailDemandeJunior);
    fixture.componentRef.setInput('id', ID);
    element = fixture.nativeElement as HTMLElement;
    documentHarnais = TestbedHarnessEnvironment.documentRootLoader(fixture);
    fixture.detectChanges();
    await repondreDetail(demande);
  }

  async function repondreDetail(demande: DemandeConsultationResponse): Promise<void> {
    const requete = http.expectOne(URL_DETAIL);
    expect(requete.request.method).toBe('GET');
    requete.flush(demande);
    await stabiliser();
  }

  function boutonCommencer(): HTMLButtonElement | null {
    return element.querySelector<HTMLButtonElement>('.bouton-commencer');
  }

  function dialogue(): HTMLElement | null {
    return document.querySelector<HTMLElement>('mat-dialog-container');
  }

  function boutonDialogue(libelle: string): HTMLButtonElement {
    return Array.from(dialogue()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === libelle,
    )!;
  }

  async function cliquer(bouton: HTMLElement | null): Promise<void> {
    expect(bouton).toBeTruthy();
    bouton!.click();
    await stabiliser();
  }

  /** Ouvre le dialogue et repond a la liste des seniors. */
  async function ouvrirDialogue(seniors = SENIORS): Promise<void> {
    await ouvrir();
    await cliquer(boutonCommencer());
    expect(dialogue()).not.toBeNull();
    const requete = http.expectOne((r) => r.url === URL_SENIORS);
    expect(requete.request.params.get('role')).toBe('SENIOR');
    requete.flush(seniors);
    await stabiliser();
  }

  async function saisir(nom: string, valeur: string): Promise<void> {
    const champ = dialogue()!.querySelector<HTMLInputElement>(`input[formcontrolname="${nom}"]`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new Event('blur'));
    await stabiliser();
  }

  async function remplir(): Promise<void> {
    await saisir('numeroDossierProxymed', '  PXM-2026-0042 ');
    await saisir('dateNaissance', '1952-04-18');
    const feminin = Array.from(dialogue()!.querySelectorAll('mat-radio-button')).find((r) =>
      r.textContent!.includes('Féminin'),
    )!;
    feminin.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
    await stabiliser();
    const liste = await documentHarnais.getHarness(MatSelectHarness);
    await liste.clickOptions({ text: 'Cheikh Sy (n° d’ordre ONMS-2015-0101)' });
    await stabiliser();
  }

  async function envoyer(): Promise<void> {
    await cliquer(boutonDialogue('Commencer'));
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DetailDemandeJunior],
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
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
  });

  it('affiche le detail complet de la demande assignee', async () => {
    await ouvrir();

    expect(element.querySelector('.nom-patient')!.textContent!.trim()).toBe('Fatou Ndiaye');
    expect(element.querySelector('.pour-proche')!.textContent!.trim()).toBe('Non');
    expect(element.querySelector('.motif')!.textContent!.trim()).toBe('Douleurs abdominales');
    expect(element.querySelector('.statut')!.textContent!.trim()).toBe('Acceptée');
    expect(element.querySelector('.date-decision')!.textContent).toContain('21/10/2026');
    expect(element.textContent).not.toContain('Accepter');
    expect(element.textContent).not.toContain('Refuser');
  });

  describe('bouton « Commencer la consultation »', () => {
    it('visible pour une demande ACCEPTEE sans consultation', async () => {
      await ouvrir();

      expect(boutonCommencer()!.textContent!.trim()).toBe('Commencer la consultation');
      expect(element.querySelector('.consultation-commencee')).toBeNull();
    });

    it('absent si la consultation est deja commencee : « Consultation commencée » a la place', async () => {
      await ouvrir(commencee);

      expect(boutonCommencer()).toBeNull();
      expect(element.querySelector('.consultation-commencee')!.textContent!.trim()).toBe(
        'Consultation commencée',
      );
    });

    it.each(['EN_ATTENTE', 'REFUSEE'] as const)('absent pour une demande %s', async (statut) => {
      await ouvrir({ ...assignee, statut, juniorId: null });

      expect(boutonCommencer()).toBeNull();
      expect(element.querySelector('.consultation-commencee')).toBeNull();
    });
  });

  describe('dialogue', () => {
    it('liste les seniors et rappelle qu’ils sont choisis a la main', async () => {
      await ouvrirDialogue();

      expect(dialogue()!.getAttribute('role')).toBe('dialog');
      expect(dialogue()!.querySelector('h2')!.textContent).toContain('Commencer la consultation');
      expect(dialogue()!.textContent).toContain('Fatou Ndiaye');
      expect(dialogue()!.textContent).toContain('le médecin senior est choisi à la main');
      const liste = await documentHarnais.getHarness(MatSelectHarness);
      await liste.open();
      const options = await liste.getOptions();
      expect(await Promise.all(options.map((o) => o.getText()))).toEqual([
        'Aminata Diop (n° d’ordre ONMS-2011-0457)',
        'Cheikh Sy (n° d’ordre ONMS-2015-0101)',
      ]);
    });

    it('les quatre champs sont obligatoires', async () => {
      await ouvrirDialogue();
      await envoyer();

      http.expectNone(URL_COMMENCER);
      const erreurs = dialogue()!.textContent!;
      expect(erreurs).toContain('Le numéro de dossier est obligatoire.');
      expect(erreurs).toContain('La date de naissance est obligatoire.');
      expect(erreurs).toContain('Le sexe est obligatoire.');
      expect(erreurs).toContain('Choisissez le médecin senior responsable.');
    });

    it('refuse un numero de plus de 100 caracteres et une date de naissance future', async () => {
      await ouvrirDialogue();
      await saisir('numeroDossierProxymed', 'N'.repeat(101));
      await saisir('dateNaissance', `${new Date().getFullYear() + 1}-01-01`);

      expect(dialogue()!.textContent).toContain('ne doit pas dépasser 100 caractères');
      expect(dialogue()!.textContent).toContain('La date de naissance doit être dans le passé.');
    });

    it('sans medecin senior dans la Fiche 1 : message clair et envoi impossible', async () => {
      await ouvrirDialogue([]);

      expect(dialogue()!.querySelector('.aucun-senior')!.textContent).toContain(
        MESSAGE_AUCUN_SENIOR,
      );
      expect(boutonDialogue('Commencer').disabled).toBe(true);
    });
  });

  it('envoie la saisie, desactive le bouton pendant l’envoi, puis affiche « Consultation commencée »', async () => {
    await ouvrirDialogue();
    await remplir();
    await envoyer();

    const requete = http.expectOne(URL_COMMENCER);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({
      numeroDossierProxymed: 'PXM-2026-0042',
      dateNaissance: '1952-04-18',
      sexe: 'F',
      medecinSeniorId: 9,
    });
    // Double-clic : le bouton est desactive et un second clic n'envoie rien.
    const bouton = dialogue()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(bouton.disabled).toBe(true);
    expect(bouton.querySelector('mat-spinner')).not.toBeNull();
    bouton.click();
    await stabiliser();
    http.expectNone(URL_COMMENCER);

    requete.flush(
      { demandeId: ID, patientId: 'p-1', consultationId: 'c-1', statutConsultation: 'BROUILLON' },
      { status: 201, statusText: 'Created' },
    );
    await stabiliser();
    await repondreDetail(commencee);

    expect(dialogue()).toBeNull();
    expect(element.querySelector('[role="status"]')!.textContent).toContain(
      MESSAGE_CONSULTATION_COMMENCEE,
    );
    expect(boutonCommencer()).toBeNull();
    expect(element.querySelector('.consultation-commencee')!.textContent).toContain(
      'Consultation commencée',
    );
  });

  describe('erreurs de l’envoi', () => {
    it('409 « Patient existant » : reste ouvert, message du serveur et champ signale', async () => {
      await ouvrirDialogue();
      await remplir();
      await envoyer();

      http
        .expectOne(URL_COMMENCER)
        .flush(
          ...erreurServeur(
            409,
            'Patient existant',
            'Un patient existe deja avec ce numero de dossier PROXYMED',
          ),
        );
      await stabiliser();

      expect(dialogue()).not.toBeNull();
      expect(dialogue()!.querySelector('[role="alert"]')!.textContent).toContain(
        'Un patient existe deja avec ce numero de dossier PROXYMED',
      );
      expect(dialogue()!.textContent).toContain(
        'Ce numéro de dossier est déjà utilisé par un autre patient.',
      );
      expect(boutonDialogue('Commencer').disabled).toBe(false);
    });

    it('409 « Consultation impossible a commencer » : ferme, affiche le message et relit', async () => {
      const message = `La consultation initiale de la demande ${ID} a deja ete commencee`;
      await ouvrirDialogue();
      await remplir();
      await envoyer();

      http
        .expectOne(URL_COMMENCER)
        .flush(...erreurServeur(409, 'Consultation impossible a commencer', message));
      await stabiliser();
      await repondreDetail(commencee);

      expect(dialogue()).toBeNull();
      const alerte = element.querySelector('.message-page')!;
      expect(alerte.getAttribute('role')).toBe('alert');
      expect(alerte.textContent).toContain(message);
      expect(boutonCommencer()).toBeNull();
      expect(element.querySelector('.consultation-commencee')).not.toBeNull();
    });

    it('400 : message et details du serveur dans le dialogue', async () => {
      await ouvrirDialogue();
      await remplir();
      await envoyer();

      http
        .expectOne(URL_COMMENCER)
        .flush(
          ...erreurServeur(
            400,
            'Regle de gestion non respectee',
            'Le medecin senior doit avoir le role SENIOR (medecin 9)',
          ),
        );
      await stabiliser();

      expect(dialogue()!.querySelector('[role="alert"]')!.textContent).toContain(
        'Le medecin senior doit avoir le role SENIOR (medecin 9)',
      );
    });

    it('403 : message clair, sans redirection', async () => {
      await ouvrirDialogue();
      await remplir();
      await envoyer();

      http
        .expectOne(URL_COMMENCER)
        .flush(
          ...erreurServeur(
            403,
            'Acces refuse',
            'Votre role ne permet pas d acceder a cette ressource',
          ),
        );
      await stabiliser();

      expect(dialogue()!.querySelector('[role="alert"]')!.textContent!.trim()).toBe(
        MESSAGE_ACCES_REFUSE_COMMENCEMENT,
      );
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('404 : message du serveur', async () => {
      await ouvrirDialogue();
      await remplir();
      await envoyer();

      http
        .expectOne(URL_COMMENCER)
        .flush(...erreurServeur(404, 'Ressource introuvable', 'Medecin introuvable : 9'));
      await stabiliser();

      expect(dialogue()!.querySelector('[role="alert"]')!.textContent).toContain(
        'Medecin introuvable : 9',
      );
    });
  });

  it.each([
    [403, MESSAGE_DEMANDE_ACCES_REFUSE],
    [404, MESSAGE_DEMANDE_INTROUVABLE],
  ])('detail sur %i : message clair, lien de retour, sans redirection', async (status, attendu) => {
    fixture = TestBed.createComponent(DetailDemandeJunior);
    fixture.componentRef.setInput('id', ID);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne(URL_DETAIL).flush(...erreurServeur(status, 'Erreur', 'Technique'));
    await stabiliser();

    expect(element.querySelector('[role="alert"]')!.textContent!.trim()).toBe(attendu);
    expect(element.textContent).not.toContain('Technique');
    expect(element.querySelectorAll('a[href="/junior/demandes"]').length).toBeGreaterThan(0);
    expect(boutonCommencer()).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
