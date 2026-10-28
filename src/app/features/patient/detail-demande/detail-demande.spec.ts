import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { DetailDemande, MESSAGE_ACCES_REFUSE, MESSAGE_INTROUVABLE } from './detail-demande';

const ID = '22222222-2222-2222-2222-222222222222';
const URL_DETAIL = `${environment.api.fiche1}/api/demandes-consultation/${ID}`;

const base: DemandeConsultationResponse = {
  id: ID,
  demandeurId: 'moi',
  nomPatient: 'Moussa Ba',
  pourProche: true,
  motif: 'Fièvre et toux depuis deux jours',
  statut: 'EN_ATTENTE',
  medecinSeniorId: null,
  juniorId: null,
  motifRefus: null,
  dateCreation: '2026-10-20T08:15:00Z',
  dateDecision: null,
};

describe('DetailDemande', () => {
  let fixture: ComponentFixture<DetailDemande>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let router: Router;

  function ouvrir(): void {
    fixture = TestBed.createComponent(DetailDemande);
    fixture.componentRef.setInput('id', ID);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function repondre(demande: DemandeConsultationResponse): void {
    http.expectOne(URL_DETAIL).flush(demande);
    fixture.detectChanges();
  }

  function echouer(status: number, message: string): void {
    http.expectOne(URL_DETAIL).flush(
      {
        horodatage: '',
        status,
        erreur: 'Erreur',
        message,
        details: ['com.proxymed.trace technique'],
      },
      { status, statusText: '' },
    );
    fixture.detectChanges();
  }

  function texte(selecteur: string): string {
    return element.querySelector(selecteur)?.textContent?.trim() ?? '';
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DetailDemande],
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

  it('affiche un indicateur pendant le chargement', () => {
    ouvrir();
    expect(element.querySelector('mat-spinner')).not.toBeNull();
    repondre(base);
    expect(element.querySelector('mat-spinner')).toBeNull();
  });

  it('affiche le detail complet d’une demande en attente', () => {
    ouvrir();
    repondre(base);

    expect(texte('.nom-patient')).toBe('Moussa Ba');
    expect(texte('.pour-proche')).toBe('Oui');
    expect(texte('.motif')).toBe('Fièvre et toux depuis deux jours');
    expect(texte('.statut')).toBe('En attente');
    expect(element.textContent).toContain('20/10/2026');
    expect(texte('.date-decision')).toBe('Pas encore de décision');
    expect(element.querySelector('.motif-refus')).toBeNull();
  });

  it('affiche la decision et le motif du refus', () => {
    ouvrir();
    repondre({
      ...base,
      statut: 'REFUSEE',
      motifRefus: 'Merci de consulter votre médecin traitant.',
      dateDecision: '2026-10-22T14:05:00Z',
    });

    expect(texte('.statut')).toBe('Refusée');
    expect(element.querySelector('.statut span')!.classList).toContain('statut-refusee');
    expect(texte('.date-decision')).toContain('22/10/2026');
    expect(texte('.motif-refus')).toContain('Merci de consulter votre médecin traitant.');
  });

  it('affiche une demande acceptee', () => {
    ouvrir();
    repondre({ ...base, statut: 'ACCEPTEE', dateDecision: '2026-10-21T10:00:00Z' });

    expect(texte('.statut')).toBe('Acceptée');
    expect(element.textContent).toContain('un médecin vous a été assigné');
  });

  it.each([
    [403, MESSAGE_ACCES_REFUSE],
    [404, MESSAGE_INTROUVABLE],
  ])('sur %i : message clair, lien de retour, aucune trace technique', (status, attendu) => {
    ouvrir();
    echouer(status, 'Message technique du serveur');

    expect(texte('[role="alert"]')).toBe(attendu);
    expect(element.textContent).not.toContain('com.proxymed');
    expect(element.textContent).not.toContain('Message technique du serveur');
    expect(element.querySelectorAll('a[href="/patient/mes-demandes"]').length).toBeGreaterThan(0);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
