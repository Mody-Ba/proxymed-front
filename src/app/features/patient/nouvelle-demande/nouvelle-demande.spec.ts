import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { MESSAGE_DEMANDE_ENVOYEE, NouvelleDemande } from './nouvelle-demande';

const URL_DEMANDES = `${environment.api.fiche1}/api/demandes-consultation`;

describe('NouvelleDemande', () => {
  let fixture: ComponentFixture<NouvelleDemande>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function champ<T extends HTMLElement = HTMLInputElement>(nom: string): T {
    return element.querySelector<T>(`[formcontrolname="${nom}"]`)!;
  }

  function saisir(nom: string, valeur: string): void {
    const c = champ<HTMLInputElement | HTMLTextAreaElement>(nom);
    c.value = valeur;
    c.dispatchEvent(new Event('input'));
    c.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function cocherProche(): void {
    element.querySelector<HTMLInputElement>('mat-checkbox input')!.click();
    fixture.detectChanges();
  }

  function soumettre(): void {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  }

  function texte(): string {
    return element.textContent ?? '';
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NouvelleDemande],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NouvelleDemande);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it("n'envoie rien et signale les champs obligatoires", () => {
    soumettre();

    http.expectNone(URL_DEMANDES);
    expect(texte()).toContain('Le nom du patient est obligatoire.');
    expect(texte()).toContain('Le motif est obligatoire.');
  });

  it("refuse un nom ou un motif fait seulement d'espaces", () => {
    saisir('nomPatient', '   ');
    saisir('motif', '  \n ');
    soumettre();

    http.expectNone(URL_DEMANDES);
    expect(texte()).toContain('Le nom du patient est obligatoire.');
    expect(texte()).toContain('Le motif est obligatoire.');
  });

  it('refuse un nom de plus de 200 caracteres', () => {
    saisir('nomPatient', 'a'.repeat(201));
    saisir('motif', 'Fièvre');
    soumettre();

    http.expectNone(URL_DEMANDES);
    expect(texte()).toContain('Le nom du patient ne doit pas dépasser 200 caractères.');
  });

  it('refuse un motif de plus de 2000 caracteres', () => {
    saisir('nomPatient', 'Awa Diallo');
    saisir('motif', 'a'.repeat(2001));
    soumettre();

    http.expectNone(URL_DEMANDES);
    expect(texte()).toContain('Le motif ne doit pas dépasser 2000 caractères.');
  });

  it('accepte exactement 200 et 2000 caracteres', () => {
    saisir('nomPatient', 'a'.repeat(200));
    saisir('motif', 'b'.repeat(2000));
    soumettre();

    http.expectOne(URL_DEMANDES).flush({}, { status: 201, statusText: '' });
  });

  it('compte les caracteres du motif', () => {
    expect(element.querySelector('.compteur')!.textContent).toContain('0 / 2000');
    saisir('motif', 'Toux sèche');
    expect(element.querySelector('.compteur')!.textContent).toContain('10 / 2000');
  });

  it('adapte le libelle du nom quand la demande concerne un proche', () => {
    expect(element.querySelector('mat-label')!.textContent).toContain('Votre nom complet');
    cocherProche();
    expect(element.querySelector('mat-label')!.textContent).toContain('Nom complet du proche');
  });

  it('envoie seulement les 3 champs puis ouvre la liste avec le message de succes', async () => {
    cocherProche();
    saisir('nomPatient', '  Moussa Ba ');
    saisir('motif', 'Fièvre depuis hier');
    soumettre();

    const requete = http.expectOne(URL_DEMANDES);
    expect(requete.request.body).toEqual({
      nomPatient: 'Moussa Ba',
      pourProche: true,
      motif: 'Fièvre depuis hier',
    });
    expect(element.querySelector('mat-spinner')).not.toBeNull();

    requete.flush({ id: 'x', statut: 'EN_ATTENTE' }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/patient/mes-demandes');
    expect(TestBed.inject(DemandeConsultationService).consommerMessageListe()).toBe(
      MESSAGE_DEMANDE_ENVOYEE,
    );
  });

  it('affiche le message et le detail des erreurs du serveur', () => {
    saisir('nomPatient', 'Awa Diallo');
    saisir('motif', 'Fièvre');
    soumettre();

    http.expectOne(URL_DEMANDES).flush(
      {
        horodatage: '',
        status: 400,
        erreur: 'Validation echouee',
        message: 'Un ou plusieurs champs sont invalides',
        details: ['motif : le motif est obligatoire'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    const alerte = element.querySelector('[role="alert"]')!.textContent;
    expect(alerte).toContain('Un ou plusieurs champs sont invalides');
    expect(alerte).toContain('motif : le motif est obligatoire');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
