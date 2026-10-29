import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import {
  MESSAGE_DEMANDE_ACCES_REFUSE,
  MESSAGE_DEMANDE_INTROUVABLE,
} from '../../../core/utils/erreur-http';
import { DetailDemandeJunior } from './detail-demande-junior';

const ID = '33333333-3333-3333-3333-333333333333';
const URL_DETAIL = `${environment.api.fiche1}/api/demandes-consultation/${ID}`;

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
};

describe('DetailDemandeJunior', () => {
  let fixture: ComponentFixture<DetailDemandeJunior>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function ouvrir(): void {
    fixture = TestBed.createComponent(DetailDemandeJunior);
    fixture.componentRef.setInput('id', ID);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DetailDemandeJunior],
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

  it('affiche le detail en lecture seule, sans aucun bouton d’action', () => {
    ouvrir();
    expect(element.querySelector('mat-spinner')).not.toBeNull();
    http.expectOne(URL_DETAIL).flush(assignee);
    fixture.detectChanges();

    expect(element.querySelector('.nom-patient')!.textContent!.trim()).toBe('Fatou Ndiaye');
    expect(element.querySelector('.pour-proche')!.textContent!.trim()).toBe('Non');
    expect(element.querySelector('.motif')!.textContent!.trim()).toBe('Douleurs abdominales');
    expect(element.querySelector('.statut')!.textContent!.trim()).toBe('Acceptée');
    expect(element.querySelector('.date-decision')!.textContent).toContain('21/10/2026');
    expect(element.querySelectorAll('button')).toHaveLength(0);
    expect(element.textContent).not.toContain('Accepter');
    expect(element.textContent).not.toContain('Refuser');
  });

  it.each([
    [403, MESSAGE_DEMANDE_ACCES_REFUSE],
    [404, MESSAGE_DEMANDE_INTROUVABLE],
  ])('sur %i : message clair, lien de retour, sans redirection', (status, attendu) => {
    ouvrir();
    http
      .expectOne(URL_DETAIL)
      .flush(
        { horodatage: '', status, erreur: 'Erreur', message: 'Technique', details: [] },
        { status, statusText: '' },
      );
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent!.trim()).toBe(attendu);
    expect(element.textContent).not.toContain('Technique');
    expect(element.querySelectorAll('a[href="/junior/demandes"]').length).toBeGreaterThan(0);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
