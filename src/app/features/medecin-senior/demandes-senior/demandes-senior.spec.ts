import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatChipListboxHarness } from '@angular/material/chips/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  DemandeConsultationResponse,
  StatutDemandeConsultation,
} from '../../../core/models/demande-consultation.model';
import { PageResponse } from '../../../core/models/page.model';
import { DemandesSenior } from './demandes-senior';

const URL_DEMANDES = `${environment.api.fiche1}/api/demandes-consultation`;

function demande(id: string, statut: StatutDemandeConsultation): DemandeConsultationResponse {
  return {
    id,
    demandeurId: 'patient',
    nomPatient: `Patient ${id}`,
    pourProche: id.endsWith('p'),
    motif: 'Motif',
    statut,
    medecinSeniorId: null,
    juniorId: null,
    motifRefus: null,
    dateCreation: '2026-10-28T09:30:00Z',
    dateDecision: null,
  };
}

function page(
  elements: DemandeConsultationResponse[],
  totalElements = elements.length,
  numero = 0,
): PageResponse<DemandeConsultationResponse> {
  return { elements, page: numero, taille: 20, totalElements, totalPages: 1 };
}

describe('DemandesSenior', () => {
  let fixture: ComponentFixture<DemandesSenior>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;
  let harnais: HarnessLoader;

  function ouvrir(): void {
    fixture = TestBed.createComponent(DemandesSenior);
    element = fixture.nativeElement as HTMLElement;
    harnais = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  /** Repond a la requete en cours et renvoie ses parametres. */
  function repondre(reponse: PageResponse<DemandeConsultationResponse>): URLSearchParams {
    const requete = http.expectOne((r) => r.url === URL_DEMANDES);
    expect(requete.request.method).toBe('GET');
    requete.flush(reponse);
    fixture.detectChanges();
    return new URLSearchParams(requete.request.params.toString());
  }

  function lignes(): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('tr.ligne'));
  }

  async function filtreActif(): Promise<string[]> {
    const liste = await harnais.getHarness(MatChipListboxHarness);
    const choisis = await liste.getChips({ selected: true });
    return Promise.all(choisis.map((c) => c.getText()));
  }

  async function choisir(libelle: string): Promise<void> {
    const liste = await harnais.getHarness(MatChipListboxHarness);
    await liste.selectChips({ text: libelle });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemandesSenior],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('propose 4 filtres et charge "En attente" par defaut', async () => {
    ouvrir();
    const params = repondre(page([demande('a', 'EN_ATTENTE')]));

    expect(params.get('statut')).toBe('EN_ATTENTE');
    expect(params.get('page')).toBe('0');
    expect(params.get('taille')).toBe('20');

    const liste = await harnais.getHarness(MatChipListboxHarness);
    const chips = await liste.getChips();
    expect(await Promise.all(chips.map((c) => c.getText()))).toEqual([
      'Toutes',
      'En attente',
      'Acceptées',
      'Refusées',
    ]);
    expect(await filtreActif()).toEqual(['En attente']);
    expect(element.querySelector('mat-chip-listbox')!.getAttribute('aria-label')).toBe(
      'Filtrer les demandes par statut',
    );
  });

  it.each([
    ['Acceptées', 'ACCEPTEE'],
    ['Refusées', 'REFUSEE'],
  ])('le filtre "%s" envoie statut=%s et revient a la premiere page', async (libelle, statut) => {
    ouvrir();
    repondre(page([demande('a', 'EN_ATTENTE')], 45));

    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    fixture.detectChanges();
    expect(repondre(page([demande('b', 'EN_ATTENTE')], 45, 1)).get('page')).toBe('1');

    await choisir(libelle);
    const params = repondre(page([demande('c', statut as StatutDemandeConsultation)]));
    expect(params.get('statut')).toBe(statut);
    expect(params.get('page')).toBe('0');
    expect(await filtreActif()).toEqual([libelle]);
  });

  it('"Toutes" n\'envoie aucun statut', async () => {
    ouvrir();
    repondre(page([]));

    await choisir('Toutes');
    const params = repondre(page([demande('a', 'ACCEPTEE'), demande('b', 'REFUSEE')]));
    expect(params.has('statut')).toBe(false);
    expect(lignes()).toHaveLength(2);
  });

  it('un clic sur le filtre deja actif le garde choisi, sans nouvelle requete', async () => {
    ouvrir();
    repondre(page([]));

    const liste = await harnais.getHarness(MatChipListboxHarness);
    const [actif] = await liste.getChips({ text: 'En attente' });
    await (await actif.host()).click();
    fixture.detectChanges();

    http.expectNone((r) => r.url === URL_DEMANDES);
    expect(await filtreActif()).toEqual(['En attente']);
  });

  it('affiche date, patient, proche et statut (icone et libelle)', () => {
    ouvrir();
    repondre(page([demande('a', 'EN_ATTENTE'), demande('bp', 'EN_ATTENTE')]));

    const [l1, l2] = lignes();
    expect(l1.textContent).toContain('28/10/2026');
    expect(l1.textContent).toContain('Patient a');
    expect(l1.textContent).toContain('Non');
    expect(l2.textContent).toContain('Oui');
    const statut = l1.querySelector('app-statut-demande span')!;
    expect(statut.textContent!.trim()).toBe('En attente');
    expect(statut.querySelector('mat-icon')!.getAttribute('aria-hidden')).toBe('true');
  });

  it("ouvre le detail au clic ou a la touche Entree, avec l'identifiant seulement", () => {
    ouvrir();
    repondre(page([demande('id-1', 'EN_ATTENTE'), demande('id-2', 'EN_ATTENTE')]));

    lignes()[0].click();
    expect(router.navigate).toHaveBeenCalledWith(['/senior/demandes', 'id-1']);
    lignes()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(router.navigate).toHaveBeenCalledWith(['/senior/demandes', 'id-2']);
  });

  it('affiche un etat vide propre au filtre', async () => {
    ouvrir();
    repondre(page([]));
    expect(element.textContent).toContain('Aucune demande en attente.');
    expect(element.querySelector('table')).toBeNull();

    await choisir('Refusées');
    repondre(page([]));
    expect(element.textContent).toContain('Aucune demande refusée.');
  });

  it('affiche le chargement puis une erreur lisible, et permet de reessayer', () => {
    ouvrir();
    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    http
      .expectOne((r) => r.url === URL_DEMANDES)
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Les demandes n’ont pas pu être chargées.',
    );
    element.querySelector<HTMLButtonElement>('.reessayer')!.click();
    expect(repondre(page([])).get('statut')).toBe('EN_ATTENTE');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
});
