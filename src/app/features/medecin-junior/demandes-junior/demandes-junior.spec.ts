import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { PageResponse } from '../../../core/models/page.model';
import { DemandesJunior, MESSAGE_AUCUNE_ASSIGNEE } from './demandes-junior';

const URL_ASSIGNEES = `${environment.api.fiche1}/api/demandes-consultation/assignees-a-moi`;

function demande(id: string): DemandeConsultationResponse {
  return {
    id,
    demandeurId: 'patient',
    nomPatient: `Patient ${id}`,
    pourProche: false,
    motif: 'Motif',
    statut: 'ACCEPTEE',
    medecinSeniorId: 'senior',
    juniorId: 'moi',
    motifRefus: null,
    dateCreation: '2026-10-28T09:30:00Z',
    dateDecision: '2026-10-28T11:00:00Z',
  };
}

function page(
  elements: DemandeConsultationResponse[],
  totalElements = elements.length,
  numero = 0,
): PageResponse<DemandeConsultationResponse> {
  return { elements, page: numero, taille: 20, totalElements, totalPages: 1 };
}

describe('DemandesJunior', () => {
  let fixture: ComponentFixture<DemandesJunior>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function ouvrir(): void {
    fixture = TestBed.createComponent(DemandesJunior);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function repondre(reponse: PageResponse<DemandeConsultationResponse>, numero = 0): void {
    const requete = http.expectOne((r) => r.url === URL_ASSIGNEES);
    expect(requete.request.method).toBe('GET');
    expect(requete.request.params.get('page')).toBe(String(numero));
    expect(requete.request.params.get('taille')).toBe('20');
    expect(requete.request.params.has('statut')).toBe(false);
    requete.flush(reponse);
    fixture.detectChanges();
  }

  function lignes(): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('tr.ligne'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemandesJunior],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("affiche l'etat vide", () => {
    ouvrir();
    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    repondre(page([]));

    expect(element.textContent).toContain(MESSAGE_AUCUNE_ASSIGNEE);
    expect(element.querySelector('table')).toBeNull();
  });

  it('affiche les demandes assignees avec la pastille de statut, sans filtre', () => {
    ouvrir();
    repondre(page([demande('a'), demande('b')]));

    expect(lignes()).toHaveLength(2);
    expect(lignes()[0].textContent).toContain('Patient a');
    expect(lignes()[0].querySelector('app-statut-demande span')!.textContent!.trim()).toBe(
      'Acceptée',
    );
    expect(element.querySelector('mat-chip-listbox')).toBeNull();
  });

  it('ouvre le detail en lecture seule, avec l’identifiant seulement', () => {
    ouvrir();
    repondre(page([demande('id-1')]));

    lignes()[0].click();
    expect(router.navigate).toHaveBeenCalledWith(['/junior/demandes', 'id-1']);
  });

  it('pagine cote serveur', () => {
    ouvrir();
    repondre(page([demande('a')], 45));

    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    fixture.detectChanges();
    repondre(page([demande('z')], 45, 1), 1);
    expect(lignes()[0].textContent).toContain('Patient z');
  });

  it('affiche une erreur lisible et permet de reessayer', () => {
    ouvrir();
    http.expectOne((r) => r.url === URL_ASSIGNEES).flush(null, { status: 0, statusText: '' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Le service est injoignable.',
    );
    element.querySelector<HTMLButtonElement>('.reessayer')!.click();
    repondre(page([]));
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
});
