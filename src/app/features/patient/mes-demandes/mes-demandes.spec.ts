import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { PageResponse } from '../../../core/models/page.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { MesDemandes } from './mes-demandes';

const URL_MES_DEMANDES = `${environment.api.fiche1}/api/demandes-consultation/mes-demandes`;

function demande(
  id: string,
  statut: DemandeConsultationResponse['statut'],
  pourProche = false,
): DemandeConsultationResponse {
  return {
    id,
    demandeurId: 'moi',
    nomPatient: `Patient ${id}`,
    pourProche,
    motif: 'Motif',
    statut,
    medecinSeniorId: null,
    juniorId: null,
    motifRefus: statut === 'REFUSEE' ? 'Hors périmètre' : null,
    dateCreation: '2026-10-28T09:30:00Z',
    dateDecision: null,
  };
}

function page(
  elements: DemandeConsultationResponse[],
  totalElements = elements.length,
  numero = 0,
  taille = 20,
): PageResponse<DemandeConsultationResponse> {
  return {
    elements,
    page: numero,
    taille,
    totalElements,
    totalPages: Math.ceil(totalElements / taille),
  };
}

describe('MesDemandes', () => {
  let fixture: ComponentFixture<MesDemandes>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function ouvrir(): void {
    fixture = TestBed.createComponent(MesDemandes);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function repondre(
    reponse: PageResponse<DemandeConsultationResponse>,
    numero = 0,
    taille = 20,
  ): void {
    const requete = http.expectOne((r) => r.url === URL_MES_DEMANDES);
    expect(requete.request.params.get('page')).toBe(String(numero));
    expect(requete.request.params.get('taille')).toBe(String(taille));
    requete.flush(reponse);
    fixture.detectChanges();
  }

  function lignes(): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('tr.ligne'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MesDemandes],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('affiche un indicateur de chargement pendant la requete', () => {
    ouvrir();
    expect(element.querySelector('mat-spinner')).not.toBeNull();
    repondre(page([]));
    expect(element.querySelector('mat-spinner')).toBeNull();
  });

  it("affiche l'etat vide", () => {
    ouvrir();
    repondre(page([]));

    expect(element.textContent).toContain("Vous n'avez aucune demande.");
    expect(element.querySelector('table')).toBeNull();
  });

  it('affiche date, patient, proche et statut avec un libelle et une couleur', () => {
    ouvrir();
    repondre(
      page([demande('a', 'EN_ATTENTE'), demande('b', 'ACCEPTEE', true), demande('c', 'REFUSEE')]),
    );

    const [l1, l2] = lignes();
    expect(l1.textContent).toContain('28/10/2026');
    expect(l1.textContent).toContain('Patient a');
    expect(l1.textContent).toContain('Non');
    expect(l2.textContent).toContain('Oui');

    const statuts = lignes().map((l) => l.querySelector('app-statut-demande span')!);
    expect(statuts.map((s) => s.textContent!.trim())).toEqual([
      'En attente',
      'Acceptée',
      'Refusée',
    ]);
    expect(statuts[0].classList).toContain('statut-en-attente');
    expect(statuts[1].classList).toContain('statut-acceptee');
    expect(statuts[2].classList).toContain('statut-refusee');
  });

  it("ouvre le detail au clic ou a la touche Entree, avec l'identifiant seulement", () => {
    ouvrir();
    repondre(page([demande('id-1', 'EN_ATTENTE'), demande('id-2', 'ACCEPTEE')]));

    lignes()[0].click();
    expect(router.navigate).toHaveBeenCalledWith(['/patient/demandes', 'id-1']);

    lignes()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(router.navigate).toHaveBeenCalledWith(['/patient/demandes', 'id-2']);
  });

  it('pagine cote serveur', () => {
    ouvrir();
    repondre(page([demande('a', 'EN_ATTENTE')], 45));

    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    fixture.detectChanges();

    repondre(page([demande('z', 'REFUSEE')], 45, 1), 1, 20);
    expect(lignes()[0].textContent).toContain('Patient z');
    expect(element.querySelector('.mat-mdc-paginator-range-label')!.textContent).toContain(
      '21 – 40 sur 45',
    );
  });

  it('affiche une erreur lisible et permet de reessayer', () => {
    ouvrir();
    http
      .expectOne((r) => r.url === URL_MES_DEMANDES)
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Vos demandes n’ont pas pu être chargées.',
    );

    element.querySelector<HTMLButtonElement>('.reessayer')!.click();
    repondre(page([]));
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('affiche le message laisse par le formulaire', () => {
    TestBed.inject(DemandeConsultationService).annoncerSurListe('Votre demande a été envoyée.');
    ouvrir();
    repondre(page([]));

    expect(element.querySelector('[role="status"]')!.textContent).toContain(
      'Votre demande a été envoyée.',
    );
  });
});
