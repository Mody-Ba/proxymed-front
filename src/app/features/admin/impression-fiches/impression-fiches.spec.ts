import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { AuthService } from '../../../core/services/auth.service';
import { ImpressionFiches } from './impression-fiches';

const API_FICHE1 = `${environment.api.fiche1}/api`;
const API_FICHE2 = `${environment.api.fiche2}/api`;

const PATIENTS = [
  { id: 'p-1', nomComplet: 'Awa Diop', numeroDossierProxymed: 'PX-1', dateNaissance: null },
  { id: 'p-2', nomComplet: 'Binta Fall', numeroDossierProxymed: 'PX-2', dateNaissance: null },
  { id: 'p-3', nomComplet: 'Cheikh Ndiaye', numeroDossierProxymed: null, dateNaissance: null },
];

describe('ImpressionFiches', () => {
  let fixture: ComponentFixture<ImpressionFiches>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImpressionFiches],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(AuthService), 'badge').mockReturnValue('badge-admin');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImpressionFiches);
    element = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(`${API_FICHE1}/patients`).flush(PATIENTS);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function stabiliser(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function cocher(id: string): void {
    (element.querySelector(`.case-patient[data-id="${id}"] input`) as HTMLInputElement).click();
    fixture.detectChanges();
  }

  function choisirType(libelle: string): void {
    const bouton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.type-visite button'),
    ).find((b) => b.textContent?.includes(libelle))!;
    bouton.click();
    fixture.detectChanges();
  }

  function boutonImprimer(): HTMLButtonElement {
    return element.querySelector('.bouton-imprimer') as HTMLButtonElement;
  }

  function message(): string {
    return element.querySelector('.message-impression')?.textContent?.trim() ?? '';
  }

  function pdf(nom: string): [Blob, { headers: Record<string, string> }] {
    return [
      new Blob(['%PDF'], { type: 'application/pdf' }),
      { headers: { 'Content-Disposition': `attachment; filename="${nom}"` } },
    ];
  }

  it('Visite initiale : appelle la Fiche 1 avec les identifiants des patients', async () => {
    cocher('p-2');
    cocher('p-1');
    choisirType('Visite initiale');
    boutonImprimer().click();
    fixture.detectChanges();

    expect(boutonImprimer().disabled).toBe(true);
    http.expectNone(`${API_FICHE2}/visites/impression-lot`);
    const requete = http.expectOne(`${API_FICHE1}/visites/impression`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({
      fiches: [
        { patientId: 'p-1', typeVisite: 'INITIALE' },
        { patientId: 'p-2', typeVisite: 'INITIALE' },
      ],
    });
    requete.flush(...pdf('fiches.pdf'));
    await stabiliser();

    expect(message()).toContain('2 fiches ont été créées');
    expect(boutonImprimer().disabled).toBe(true); // selection videe
  });

  it('Visite de routine : appelle la Fiche 2 avec les numéros de dossier et le badge', async () => {
    cocher('p-2');
    cocher('p-1');
    choisirType('Visite de routine');
    boutonImprimer().click();
    fixture.detectChanges();

    expect(boutonImprimer().disabled).toBe(true);
    http.expectNone(`${API_FICHE1}/visites/impression`);
    const requete = http.expectOne(`${API_FICHE2}/visites/impression-lot`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.responseType).toBe('blob');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer badge-admin');
    expect(requete.request.body).toEqual({ numerosDossierProxymed: ['PX-1', 'PX-2'] });
    requete.flush(...pdf('fiches-suivi-2026-11-15-2.pdf'));
    await stabiliser();

    expect(message()).toContain('2 fiches ont été créées');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('Visite de routine : bloque un patient sans numéro de dossier, sans requête', () => {
    cocher('p-1');
    cocher('p-3');
    choisirType('Visite de routine');
    boutonImprimer().click();
    fixture.detectChanges();

    http.expectNone(`${API_FICHE2}/visites/impression-lot`);
    expect(message()).toContain('n’a pas de numéro de dossier PROXYMED : Cheikh Ndiaye');
    expect(boutonImprimer().disabled).toBe(false);
  });

  it('Visite de routine : affiche les numéros introuvables dans la Fiche 2 (corps Blob relu)', async () => {
    cocher('p-1');
    cocher('p-2');
    choisirType('Visite de routine');
    boutonImprimer().click();
    fixture.detectChanges();

    const corps = {
      horodatage: '2026-11-15T10:00:00Z',
      status: 404,
      erreur: 'Ressource introuvable',
      message:
        "2 numero(s) de dossier PROXYMED introuvable(s) dans la Fiche 2 : aucune fiche n'a ete creee",
      details: ['PX-1', 'PX-2'],
    };
    http
      .expectOne(`${API_FICHE2}/visites/impression-lot`)
      .flush(new Blob([JSON.stringify(corps)], { type: 'application/json' }), {
        status: 404,
        statusText: 'Not Found',
      });
    await stabiliser();

    expect(message()).toBe(
      'Ces patients n’existent pas dans la Fiche 2 : PX-1, PX-2. Aucune fiche n’a été créée.',
    );
    expect(boutonImprimer().disabled).toBe(false); // selection conservee
  });
});
