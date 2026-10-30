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
import {
  MESSAGE_DEMANDE_ACCES_REFUSE,
  MESSAGE_DEMANDE_INTROUVABLE,
} from '../../../core/utils/erreur-http';
import { MESSAGE_CONFLIT } from '../decision';
import { MESSAGE_AUCUN_JUNIOR } from '../dialogue-acceptation/dialogue-acceptation';
import { MESSAGE_DEMANDE_REFUSEE } from '../dialogue-refus/dialogue-refus';
import { DetailDemandeSenior } from './detail-demande-senior';

const ID = '22222222-2222-2222-2222-222222222222';
const URL_DETAIL = `${environment.api.fiche1}/api/demandes-consultation/${ID}`;
const URL_JUNIORS = `${environment.api.auth}/api/auth/medecins-juniors`;

const enAttente: DemandeConsultationResponse = {
  id: ID,
  demandeurId: 'patient',
  nomPatient: 'Moussa Ba',
  pourProche: true,
  motif: 'Fièvre et toux depuis deux jours',
  statut: 'EN_ATTENTE',
  medecinSeniorId: null,
  juniorId: null,
  motifRefus: null,
  dateCreation: '2026-10-20T08:15:00Z',
  dateDecision: null,
  consultationId: null,
};
const acceptee: DemandeConsultationResponse = {
  ...enAttente,
  statut: 'ACCEPTEE',
  medecinSeniorId: 'senior',
  juniorId: 'j-2',
  dateDecision: '2026-10-21T10:00:00Z',
};
const refusee: DemandeConsultationResponse = {
  ...enAttente,
  statut: 'REFUSEE',
  medecinSeniorId: 'senior',
  motifRefus: 'Merci de consulter votre médecin traitant.',
  dateDecision: '2026-10-21T10:00:00Z',
};
const JUNIORS = [
  { id: 'j-1', nomComplet: 'Dr Aminata Sow' },
  { id: 'j-2', nomComplet: 'Dr Ibrahima Fall' },
];

function erreurServeur(status: number, message = 'Message technique du serveur') {
  return {
    corps: { horodatage: '', status, erreur: 'Erreur', message, details: [] },
    options: { status, statusText: '' },
  };
}

describe('DetailDemandeSenior', () => {
  let fixture: ComponentFixture<DetailDemandeSenior>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  let documentHarnais: HarnessLoader;

  function ouvrir(): void {
    fixture = TestBed.createComponent(DetailDemandeSenior);
    fixture.componentRef.setInput('id', ID);
    element = fixture.nativeElement as HTMLElement;
    documentHarnais = TestbedHarnessEnvironment.documentRootLoader(fixture);
    fixture.detectChanges();
  }

  async function stabiliser(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function repondreDetail(demande: DemandeConsultationResponse): Promise<void> {
    const requete = http.expectOne(URL_DETAIL);
    expect(requete.request.method).toBe('GET');
    requete.flush(demande);
    await stabiliser();
  }

  function bouton(libelle: string, racine: ParentNode = element): HTMLButtonElement | undefined {
    return Array.from(racine.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === libelle,
    );
  }

  function dialogue(): HTMLElement | null {
    return document.querySelector<HTMLElement>('mat-dialog-container');
  }

  async function cliquer(b: HTMLButtonElement | undefined): Promise<void> {
    expect(b).toBeDefined();
    b!.click();
    await stabiliser();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DetailDemandeSenior],
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

  it('affiche le detail complet et les deux boutons sur une demande en attente', async () => {
    ouvrir();
    expect(element.querySelector('mat-spinner')).not.toBeNull();
    await repondreDetail(enAttente);

    expect(element.querySelector('.nom-patient')!.textContent!.trim()).toBe('Moussa Ba');
    expect(element.querySelector('.pour-proche')!.textContent!.trim()).toBe('Oui');
    expect(element.querySelector('.motif')!.textContent!.trim()).toBe(enAttente.motif);
    expect(element.querySelector('.statut')!.textContent!.trim()).toBe('En attente');
    expect(element.querySelector('.date-decision')!.textContent!.trim()).toBe(
      'Pas encore de décision',
    );
    expect(bouton('Accepter')).toBeDefined();
    expect(bouton('Refuser')).toBeDefined();
  });

  it.each([
    ['acceptee', acceptee],
    ['refusee', refusee],
  ])('demande %s : aucun bouton de decision', async (_, demande) => {
    ouvrir();
    await repondreDetail(demande);

    expect(bouton('Accepter')).toBeUndefined();
    expect(bouton('Refuser')).toBeUndefined();
    expect(element.querySelector('.date-decision')!.textContent).toContain('21/10/2026');
  });

  it('affiche le motif du refus', async () => {
    ouvrir();
    await repondreDetail(refusee);

    expect(element.querySelector('.motif-refus')!.textContent).toContain(refusee.motifRefus);
  });

  it.each([
    [403, MESSAGE_DEMANDE_ACCES_REFUSE],
    [404, MESSAGE_DEMANDE_INTROUVABLE],
  ])('sur %i : message clair, lien de retour, sans redirection', async (status, attendu) => {
    ouvrir();
    const { corps, options } = erreurServeur(status);
    http.expectOne(URL_DETAIL).flush(corps, options);
    await stabiliser();

    expect(element.querySelector('[role="alert"]')!.textContent!.trim()).toBe(attendu);
    expect(element.textContent).not.toContain('Message technique du serveur');
    expect(element.querySelectorAll('a[href="/senior/demandes"]').length).toBeGreaterThan(0);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  describe('Accepter', () => {
    async function ouvrirDialogue(juniors = JUNIORS): Promise<void> {
      ouvrir();
      await repondreDetail(enAttente);
      await cliquer(bouton('Accepter'));
      expect(dialogue()).not.toBeNull();
      expect(dialogue()!.textContent).toContain('Chargement des médecins juniors');
      const requete = http.expectOne(URL_JUNIORS);
      expect(requete.request.method).toBe('GET');
      requete.flush(juniors);
      await stabiliser();
    }

    it('liste les juniors par leur nom et envoie seulement l’identifiant choisi', async () => {
      await ouvrirDialogue();
      expect(dialogue()!.getAttribute('role')).toBe('dialog');
      expect(dialogue()!.querySelector('h2')!.textContent).toContain('Accepter la demande');

      const liste = await documentHarnais.getHarness(MatSelectHarness);
      await liste.open();
      const options = await liste.getOptions();
      expect(await Promise.all(options.map((o) => o.getText()))).toEqual([
        'Dr Aminata Sow',
        'Dr Ibrahima Fall',
      ]);
      await liste.clickOptions({ text: 'Dr Ibrahima Fall' });
      await cliquer(bouton('Accepter', dialogue()!));

      const requete = http.expectOne(`${URL_DETAIL}/accepter`);
      expect(requete.request.method).toBe('PATCH');
      expect(requete.request.body).toEqual({ juniorId: 'j-2' });
      requete.flush(acceptee);
      await stabiliser();

      // Le detail est relu apres la decision.
      await repondreDetail(acceptee);
      expect(dialogue()).toBeNull();
      expect(element.querySelector('[role="status"]')!.textContent).toContain(
        'La demande a été acceptée et assignée à Dr Ibrahima Fall.',
      );
      expect(element.querySelector('.statut')!.textContent!.trim()).toBe('Acceptée');
      expect(bouton('Accepter')).toBeUndefined();
    });

    it('le choix du junior est obligatoire', async () => {
      await ouvrirDialogue();
      await cliquer(bouton('Accepter', dialogue()!));

      http.expectNone(`${URL_DETAIL}/accepter`);
      expect(dialogue()!.querySelector('mat-error')!.textContent).toContain(
        'Choisissez le médecin junior',
      );
    });

    it('sans junior actif : message clair et acceptation impossible', async () => {
      await ouvrirDialogue([]);

      expect(dialogue()!.querySelector('.aucun-junior')!.textContent).toContain(
        MESSAGE_AUCUN_JUNIOR,
      );
      expect(dialogue()!.querySelector('mat-select')).toBeNull();
      expect(bouton('Accepter', dialogue()!)!.disabled).toBe(true);
    });

    it('si la liste des juniors echoue : erreur lisible et nouvel essai', async () => {
      ouvrir();
      await repondreDetail(enAttente);
      await cliquer(bouton('Accepter'));
      http.expectOne(URL_JUNIORS).flush(null, { status: 500, statusText: '' });
      await stabiliser();

      expect(dialogue()!.querySelector('.erreur-juniors')!.textContent).toContain(
        'La liste des médecins juniors n’a pas pu être chargée.',
      );
      await cliquer(bouton('Réessayer', dialogue()!));
      http.expectOne(URL_JUNIORS).flush(JUNIORS);
      await stabiliser();
      expect(dialogue()!.querySelector('mat-select')).not.toBeNull();
    });

    it('sur 409 : ferme le dialogue, previent et relit la demande', async () => {
      await ouvrirDialogue();
      const liste = await documentHarnais.getHarness(MatSelectHarness);
      await liste.clickOptions({ text: 'Dr Aminata Sow' });
      await cliquer(bouton('Accepter', dialogue()!));

      const { corps, options } = erreurServeur(409, 'La demande a deja ete traitee');
      http.expectOne(`${URL_DETAIL}/accepter`).flush(corps, options);
      await stabiliser();
      await repondreDetail(refusee);

      expect(dialogue()).toBeNull();
      expect(element.querySelector('.message-page')!.textContent).toContain(MESSAGE_CONFLIT);
      expect(element.querySelector('.message-page')!.getAttribute('role')).toBe('alert');
      expect(element.querySelector('.statut')!.textContent!.trim()).toBe('Refusée');
      expect(bouton('Refuser')).toBeUndefined();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('Annuler ferme le dialogue sans rien envoyer', async () => {
      await ouvrirDialogue();
      await cliquer(bouton('Annuler', dialogue()!));

      expect(dialogue()).toBeNull();
      http.expectNone(`${URL_DETAIL}/accepter`);
      expect(element.querySelector('.message-page')).toBeNull();
    });
  });

  describe('Refuser', () => {
    async function ouvrirDialogue(): Promise<HTMLTextAreaElement> {
      ouvrir();
      await repondreDetail(enAttente);
      await cliquer(bouton('Refuser'));
      expect(dialogue()!.querySelector('h2')!.textContent).toContain('Refuser la demande');
      return dialogue()!.querySelector<HTMLTextAreaElement>('textarea')!;
    }

    async function saisir(zone: HTMLTextAreaElement, texte: string): Promise<void> {
      zone.value = texte;
      zone.dispatchEvent(new Event('input'));
      await stabiliser();
    }

    it('le motif est obligatoire (des espaces ne suffisent pas)', async () => {
      const zone = await ouvrirDialogue();
      await cliquer(bouton('Refuser', dialogue()!));
      expect(dialogue()!.querySelector('mat-error')!.textContent).toContain(
        'Le motif du refus est obligatoire.',
      );

      await saisir(zone, '   ');
      await cliquer(bouton('Refuser', dialogue()!));
      http.expectNone(`${URL_DETAIL}/refuser`);
      expect(dialogue()!.querySelector('mat-error')!.textContent).toContain('obligatoire');
    });

    it('compte les caracteres et refuse plus de 1000 caracteres', async () => {
      const zone = await ouvrirDialogue();
      expect(dialogue()!.querySelector('.compteur')!.textContent!.trim()).toBe('0 / 1000');

      await saisir(zone, 'x'.repeat(1001));
      expect(dialogue()!.querySelector('.compteur')!.textContent!.trim()).toBe('1001 / 1000');
      await cliquer(bouton('Refuser', dialogue()!));
      http.expectNone(`${URL_DETAIL}/refuser`);
      expect(dialogue()!.querySelector('mat-error')!.textContent).toContain(
        'ne doit pas dépasser 1000 caractères',
      );
    });

    it('envoie le motif, confirme et relit la demande', async () => {
      const zone = await ouvrirDialogue();
      await saisir(zone, '  Merci de consulter votre médecin traitant.  ');
      await cliquer(bouton('Refuser', dialogue()!));

      const requete = http.expectOne(`${URL_DETAIL}/refuser`);
      expect(requete.request.method).toBe('PATCH');
      expect(requete.request.body).toEqual({
        motifRefus: 'Merci de consulter votre médecin traitant.',
      });
      requete.flush(refusee);
      await stabiliser();
      await repondreDetail(refusee);

      expect(dialogue()).toBeNull();
      expect(element.querySelector('[role="status"]')!.textContent).toContain(
        MESSAGE_DEMANDE_REFUSEE,
      );
      expect(element.querySelector('.motif-refus')!.textContent).toContain(refusee.motifRefus);
    });

    it('sur 409 : message clair et demande relue', async () => {
      const zone = await ouvrirDialogue();
      await saisir(zone, 'Hors périmètre');
      await cliquer(bouton('Refuser', dialogue()!));

      const { corps, options } = erreurServeur(409);
      http.expectOne(`${URL_DETAIL}/refuser`).flush(corps, options);
      await stabiliser();
      await repondreDetail(acceptee);

      expect(dialogue()).toBeNull();
      expect(element.querySelector('.message-page')!.textContent).toContain(MESSAGE_CONFLIT);
      expect(element.querySelector('.statut')!.textContent!.trim()).toBe('Acceptée');
    });

    it('une erreur de validation du serveur reste affichee dans le dialogue', async () => {
      const zone = await ouvrirDialogue();
      await saisir(zone, 'Motif');
      await cliquer(bouton('Refuser', dialogue()!));

      http.expectOne(`${URL_DETAIL}/refuser`).flush(
        {
          horodatage: '',
          status: 400,
          erreur: 'Validation echouee',
          message: 'Un ou plusieurs champs sont invalides',
          details: ['motifRefus : le motif de refus est obligatoire'],
        },
        { status: 400, statusText: '' },
      );
      await stabiliser();

      expect(dialogue()).not.toBeNull();
      const alerte = dialogue()!.querySelector('[role="alert"]')!;
      expect(alerte.textContent).toContain('Un ou plusieurs champs sont invalides');
      expect(alerte.textContent).toContain('motifRefus : le motif de refus est obligatoire');
    });
  });

  it('ne garde ni motif ni nom du patient dans le stockage du navigateur', async () => {
    ouvrir();
    await repondreDetail(refusee);

    const stockage = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stockage).not.toContain(refusee.nomPatient);
    expect(stockage).not.toContain(refusee.motif);
    expect(stockage).not.toContain(refusee.motifRefus);
  });
});
