import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { FicheSigneeResponse } from '../../../core/models/fiche-signee.model';
import {
  MESSAGE_FICHE_NON_ASSIGNEE,
  MESSAGE_FICHE_SIGNEE_INTROUVABLE,
  MESSAGE_IMPORT_DEJA_IMPORTEE,
  MESSAGE_IMPORT_FICHE_ILLISIBLE,
  MESSAGE_IMPORT_FICHIER_ABSENT,
  MESSAGE_IMPORT_INTERROMPU,
  MESSAGE_IMPORT_INTROUVABLE,
  MESSAGE_IMPORT_NON_PDF,
  MESSAGE_IMPORT_QR_INTROUVABLE,
  MESSAGE_IMPORT_TROP_VOLUMINEUX,
} from '../../../core/utils/erreur-http';
import {
  FicheConsultationPapier,
  MESSAGE_FICHE_IMPORTEE,
  MESSAGE_FICHIER_NON_PDF,
  MESSAGE_FICHIER_TROP_VOLUMINEUX,
  MESSAGE_FICHIER_VIDE,
  MESSAGE_VERIFICATION_IMPOSSIBLE,
} from './fiche-consultation-papier';

const API = `${environment.api.fiche1}/api`;
const CONSULTATION = 'c-1';
const PATIENT = 'p-1';
const URL_PDF = `${API}/consultations/${CONSULTATION}/pdf`;
const URL_SCAN = `${API}/consultations/${CONSULTATION}/fiche-signee`;
const URL_CONSULTATION = `${API}/consultations/${CONSULTATION}`;
const URL_LISTE = `${API}/patients/${PATIENT}/fiches-signees`;
const URL_IMPORT = `${API}/fiches-signees/import`;

const fiche: FicheSigneeResponse = {
  id: 'f-1',
  patientId: PATIENT,
  consultationId: CONSULTATION,
  dateConsultation: '2026-10-30',
  nomFichier: 'scan-fiche.pdf',
  tailleOctets: 1536,
  dateImport: '2026-10-31T09:30:00',
};

function pdf(nom = 'scan-fiche.pdf', type = 'application/pdf', taille?: number): File {
  const fichier = new File(['%PDF-1.7'], nom, { type });
  if (taille !== undefined) {
    Object.defineProperty(fichier, 'size', { value: taille });
  }
  return fichier;
}

describe('FicheConsultationPapier', () => {
  let fixture: ComponentFixture<FicheConsultationPapier>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  let clicsLien: ReturnType<typeof vi.spyOn>;
  let creerAdresse: ReturnType<typeof vi.fn>;

  async function stabiliser(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Ouvre le composant et repond a la recherche d'une fiche deja importee. */
  async function ouvrir(dejaImportee: FicheSigneeResponse | null = null): Promise<void> {
    fixture = TestBed.createComponent(FicheConsultationPapier);
    fixture.componentRef.setInput('consultationId', CONSULTATION);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne(URL_CONSULTATION).flush({ patient: { id: PATIENT } });
    http.expectOne(URL_LISTE).flush(dejaImportee ? [dejaImportee] : []);
    await stabiliser();
  }

  function bouton(classe: string): HTMLButtonElement | null {
    return element.querySelector<HTMLButtonElement>(`.${classe}`);
  }

  function message(): HTMLElement | null {
    return element.querySelector<HTMLElement>('.message-fiche');
  }

  async function choisir(fichier: File): Promise<void> {
    const champ = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(champ, 'files', { value: [fichier], configurable: true });
    champ.dispatchEvent(new Event('change'));
    await stabiliser();
  }

  function erreurServeur(
    status: number,
    erreur: string,
  ): [object, { status: number; statusText: string }] {
    return [
      { horodatage: '', status, erreur, message: 'detail technique', details: [] },
      { status, statusText: '' },
    ];
  }

  async function importerEtRepondre(...reponse: Parameters<TestRequest['flush']>): Promise<void> {
    await choisir(pdf());
    http.expectOne(URL_IMPORT).flush(...reponse);
    await stabiliser();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FicheConsultationPapier],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    creerAdresse = vi.fn(() => 'blob:fiche');
    URL.createObjectURL = creerAdresse as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    clicsLien = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  describe('telechargement de la fiche', () => {
    it('desactive le bouton pendant le chargement, puis enregistre avec le nom du serveur', async () => {
      await ouvrir();
      const telecharger = bouton('bouton-telecharger-fiche')!;

      telecharger.click();
      await stabiliser();
      expect(telecharger.disabled).toBe(true);

      const contenu = new Blob(['%PDF-'], { type: 'application/pdf' });
      http.expectOne(URL_PDF).flush(contenu, {
        headers: { 'Content-Disposition': 'attachment; filename="fiche-consultation-c-1.pdf"' },
      });
      await stabiliser();

      expect(telecharger.disabled).toBe(false);
      expect(creerAdresse).toHaveBeenCalledWith(contenu);
      expect(clicsLien).toHaveBeenCalledTimes(1);
      const lien = clicsLien.mock.contexts[0] as HTMLAnchorElement;
      expect(lien.download).toBe('fiche-consultation-c-1.pdf');
    });

    it('403 : « cette consultation ne vous est pas assignée », sans redirection', async () => {
      await ouvrir();
      bouton('bouton-telecharger-fiche')!.click();
      await stabiliser();

      http.expectOne(URL_PDF).flush(new Blob(['{}']), { status: 403, statusText: 'Forbidden' });
      await stabiliser();

      expect(message()!.textContent!.trim()).toBe(MESSAGE_FICHE_NON_ASSIGNEE);
      expect(message()!.getAttribute('role')).toBe('alert');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(clicsLien).not.toHaveBeenCalled();
    });
  });

  describe('validation locale avant import', () => {
    it.each([
      ['un fichier qui n’est pas un PDF', pdf('photo.jpg', 'image/jpeg'), MESSAGE_FICHIER_NON_PDF],
      ['un fichier vide', pdf('vide.pdf', 'application/pdf', 0), MESSAGE_FICHIER_VIDE],
      [
        'un fichier de plus de 10 Mo',
        pdf('gros.pdf', 'application/pdf', 10 * 1024 * 1024 + 1),
        MESSAGE_FICHIER_TROP_VOLUMINEUX,
      ],
    ])('refuse %s sans rien envoyer', async (_cas, fichier, attendu) => {
      await ouvrir();

      await choisir(fichier);

      http.expectNone(URL_IMPORT);
      expect(message()!.textContent!.trim()).toBe(attendu);
    });

    it('accepte exactement 10 Mo', async () => {
      await ouvrir();

      await choisir(pdf('limite.pdf', 'application/pdf', 10 * 1024 * 1024));

      http.expectOne(URL_IMPORT).flush(fiche, { status: 201, statusText: 'Created' });
      await stabiliser();
    });

    it('un .pdf sans type declare part avec le type application/pdf', async () => {
      await ouvrir();

      await choisir(pdf('scan.pdf', ''));

      const requete = http.expectOne(URL_IMPORT);
      expect(((requete.request.body as FormData).get('fichier') as File).type).toBe(
        'application/pdf',
      );
      requete.flush(fiche, { status: 201, statusText: 'Created' });
      await stabiliser();
    });
  });

  describe('import', () => {
    it('envoie la partie « fichier », bloque un second envoi, puis affiche le resultat', async () => {
      await ouvrir();
      const importer = bouton('bouton-importer-fiche')!;

      await choisir(pdf());
      expect(importer.disabled).toBe(true);
      await choisir(pdf('deuxieme.pdf'));

      const requete = http.expectOne(URL_IMPORT);
      expect(((requete.request.body as FormData).get('fichier') as File).name).toBe(
        'scan-fiche.pdf',
      );
      requete.flush(fiche, { status: 201, statusText: 'Created' });
      await stabiliser();

      expect(message()!.textContent!.trim()).toBe(MESSAGE_FICHE_IMPORTEE);
      expect(message()!.getAttribute('role')).toBe('status');
      expect(element.querySelector('.nom-fichier')!.textContent!.trim()).toBe('scan-fiche.pdf');
      expect(element.querySelector('.taille-fichier')!.textContent!.trim()).toBe('1,5 Ko');
      expect(element.querySelector('.date-import')!.textContent!.trim()).toBe('31/10/2026 à 09:30');
      expect(bouton('bouton-importer-fiche')).toBeNull();
      expect(bouton('bouton-telecharger-scan')).not.toBeNull();
    });

    it.each([
      [400, 'Requete invalide', MESSAGE_IMPORT_FICHIER_ABSENT],
      [400, 'Regle de gestion non respectee', MESSAGE_IMPORT_FICHE_ILLISIBLE],
      [403, 'Acces refuse', MESSAGE_FICHE_NON_ASSIGNEE],
      [404, 'Ressource introuvable', MESSAGE_IMPORT_INTROUVABLE],
      [413, 'Fichier trop volumineux', MESSAGE_IMPORT_TROP_VOLUMINEUX],
      [415, 'Format de fichier non supporte', MESSAGE_IMPORT_NON_PDF],
      [422, 'Code QR introuvable', MESSAGE_IMPORT_QR_INTROUVABLE],
    ])('%i « %s » : message clair, jamais le message brut', async (status, erreur, attendu) => {
      await ouvrir();

      await importerEtRepondre(...erreurServeur(status, erreur));

      expect(message()!.textContent!.trim()).toBe(attendu);
      expect(message()!.getAttribute('role')).toBe('alert');
      expect(element.textContent).not.toContain('detail technique');
      expect(bouton('bouton-importer-fiche')!.disabled).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('413 sans corps lisible : message par defaut sur la taille', async () => {
      await ouvrir();

      await importerEtRepondre(null, { status: 413, statusText: '' });

      expect(message()!.textContent!.trim()).toBe(MESSAGE_IMPORT_TROP_VOLUMINEUX);
    });

    it('connexion coupee (statut 0) : message sur la connexion et la taille', async () => {
      await ouvrir();
      await choisir(pdf());

      http.expectOne(URL_IMPORT).error(new ProgressEvent('error'), { status: 0 });
      await stabiliser();

      expect(message()!.textContent!.trim()).toBe(MESSAGE_IMPORT_INTERROMPU);
    });

    it('409 « Fiche signee deja importee » : message puis affichage de la fiche du serveur', async () => {
      await ouvrir();

      await importerEtRepondre(...erreurServeur(409, 'Fiche signee deja importee'));
      http.expectOne(URL_CONSULTATION).flush({ patient: { id: PATIENT } });
      http.expectOne(URL_LISTE).flush([fiche]);
      await stabiliser();

      expect(message()!.textContent!.trim()).toBe(MESSAGE_IMPORT_DEJA_IMPORTEE);
      expect(element.querySelector('.nom-fichier')!.textContent!.trim()).toBe('scan-fiche.pdf');
    });
  });

  describe('fiche deja importee au chargement', () => {
    it('affiche la fiche et permet de telecharger le scan', async () => {
      await ouvrir(fiche);

      expect(element.querySelector('.nom-fichier')!.textContent!.trim()).toBe('scan-fiche.pdf');
      expect(bouton('bouton-importer-fiche')).toBeNull();

      bouton('bouton-telecharger-scan')!.click();
      await stabiliser();
      expect(bouton('bouton-telecharger-scan')!.disabled).toBe(true);
      http.expectOne(URL_SCAN).flush(new Blob(['%PDF-']), {
        headers: { 'Content-Disposition': 'attachment; filename="scan-fiche.pdf"' },
      });
      await stabiliser();

      expect((clicsLien.mock.contexts[0] as HTMLAnchorElement).download).toBe('scan-fiche.pdf');
    });

    it('aucune fiche : etat normal, aucun message', async () => {
      await ouvrir();

      expect(message()).toBeNull();
      expect(element.querySelector('.fiche-importee')).toBeNull();
      expect(element.querySelector('.verification-echec')).toBeNull();
      expect(bouton('bouton-importer-fiche')!.disabled).toBe(false);
    });

    it('404 a la recherche : etat normal, aucune erreur affichee', async () => {
      fixture = TestBed.createComponent(FicheConsultationPapier);
      fixture.componentRef.setInput('consultationId', CONSULTATION);
      element = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      http.expectOne(URL_CONSULTATION).flush(...erreurServeur(404, 'Ressource introuvable'));
      await stabiliser();

      expect(message()).toBeNull();
      expect(element.querySelector('.verification-echec')).toBeNull();
      expect(element.querySelector('[role="alert"]')).toBeNull();
      expect(bouton('bouton-importer-fiche')!.disabled).toBe(false);
    });

    it('404 au telechargement du scan : message « aucune fiche importée »', async () => {
      await ouvrir(fiche);
      bouton('bouton-telecharger-scan')!.click();
      await stabiliser();

      http.expectOne(URL_SCAN).flush(new Blob(['{}']), { status: 404, statusText: 'Not Found' });
      await stabiliser();

      expect(message()!.textContent!.trim()).toBe(MESSAGE_FICHE_SIGNEE_INTROUVABLE);
    });

    it('autre echec de la recherche : avertissement, import toujours possible', async () => {
      fixture = TestBed.createComponent(FicheConsultationPapier);
      fixture.componentRef.setInput('consultationId', CONSULTATION);
      element = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      http.expectOne(URL_CONSULTATION).flush(null, { status: 500, statusText: '' });
      await stabiliser();

      expect(element.querySelector('.verification-echec')!.textContent!.trim()).toBe(
        MESSAGE_VERIFICATION_IMPOSSIBLE,
      );
      expect(bouton('bouton-importer-fiche')!.disabled).toBe(false);
    });
  });
});
