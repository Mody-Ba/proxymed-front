import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { PageResponse } from '../../../core/models/page.model';
import { DecisionLotResponse, FicheAViserResponse } from '../../../core/models/visa-fiche.model';
import { MESSAGE_DECISION_CONFLIT, MESSAGE_DECISION_VISEE } from '../../../core/utils/visa-fiches';
import { FichesAViser } from './fiches-a-viser';

const API = `${environment.api.fiche1}/api/fiches-signees`;

function fiche(n: number): FicheAViserResponse {
  return {
    ficheId: `f-${n}`,
    visiteId: `v-${n}`,
    patientId: `p-${n}`,
    nomPatient: `Patient ${n}`,
    numeroDossierProxymed: `PX-${n}`,
    typeVisite: n % 2 ? 'ROUTINE' : 'INITIALE',
    dateImport: '2026-11-01T10:00:00Z',
    statut: 'EN_ATTENTE',
  };
}

function page(
  fiches: FicheAViserResponse[],
  total = fiches.length,
): PageResponse<FicheAViserResponse> {
  return { elements: fiches, page: 0, taille: 20, totalElements: total, totalPages: 1 };
}

describe('FichesAViser', () => {
  let fixture: ComponentFixture<FichesAViser>;
  let http: HttpTestingController;
  let reponseDialogue: unknown;
  let element: HTMLElement;

  beforeEach(() => {
    reponseDialogue = true;
    TestBed.configureTestingModule({
      imports: [FichesAViser],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => of(reponseDialogue) }) },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FichesAViser);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function stabiliser(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function repondreListe(fiches: FicheAViserResponse[]): void {
    const requete = http.expectOne((r) => r.url === API && r.method === 'GET');
    expect(requete.request.params.get('statut')).toBe('EN_ATTENTE');
    requete.flush(page(fiches));
  }

  function cocher(selecteur: string): void {
    (element.querySelector(`${selecteur} input`) as HTMLInputElement).click();
    fixture.detectChanges();
  }

  function bouton(classe: string): HTMLButtonElement {
    return element.querySelector(`.${classe}`) as HTMLButtonElement;
  }

  it('liste les fiches en attente avec identite, type de visite et bouton scan', async () => {
    repondreListe([fiche(1), fiche(2)]);
    await stabiliser();

    const lignes = element.querySelectorAll('tr.mat-mdc-row');
    expect(lignes.length).toBe(2);
    expect(lignes[0].textContent).toContain('Patient 1');
    expect(lignes[0].textContent).toContain('PX-1');
    expect(lignes[0].textContent).toContain('Visite de routine');
    expect(lignes[1].textContent).toContain('Visite initiale');
    expect(element.querySelectorAll('.bouton-scan').length).toBe(2);
    expect(bouton('bouton-viser').disabled).toBe(true);
  });

  it('visa en lot : une fiche en 409 ne bloque pas les autres, puis la liste est rafraichie', async () => {
    repondreListe([fiche(1), fiche(2), fiche(3)]);
    await stabiliser();

    cocher('.case-page');
    expect(element.querySelector('.compteur')!.textContent).toContain('3');
    bouton('bouton-viser').click();
    fixture.detectChanges();

    const visa = http.expectOne(`${API}/visa`);
    expect(visa.request.method).toBe('POST');
    expect(visa.request.body).toEqual({ visiteIds: ['v-1', 'v-2', 'v-3'] });
    // Boutons desactives pendant l'appel.
    expect(bouton('bouton-viser').disabled).toBe(true);
    expect(bouton('bouton-renvoyer').disabled).toBe(true);

    const reponse: DecisionLotResponse = {
      nombreFiches: 3,
      nombreReussies: 2,
      nombreErreurs: 1,
      resultats: [
        { index: 0, visiteId: 'v-1', resultat: 'VISEE', code: 200, statut: 'VISEE' },
        { index: 1, visiteId: 'v-2', resultat: 'ERREUR', code: 409, erreur: 'Conflit' },
        { index: 2, visiteId: 'v-3', resultat: 'VISEE', code: 200, statut: 'VISEE' },
      ],
    };
    visa.flush(reponse);
    repondreListe([]);
    await stabiliser();

    const resultats = element.querySelectorAll('.resultats tr.mat-mdc-row');
    expect(resultats.length).toBe(3);
    expect(resultats[0].textContent).toContain('Patient 1 (PX-1)');
    expect(resultats[0].textContent).toContain(MESSAGE_DECISION_VISEE);
    expect(resultats[1].textContent).toContain('Déjà traitée');
    expect(resultats[1].textContent).toContain(MESSAGE_DECISION_CONFLIT);
    expect(element.querySelectorAll('.resultats .bouton-rapport').length).toBe(2);
    expect(element.querySelector('.resume')!.textContent).toContain('2 visées, 1 non traitée');
  });

  it('renvoi en lot avec le motif du dialogue', async () => {
    reponseDialogue = 'Code QR illisible';
    repondreListe([fiche(1), fiche(2)]);
    await stabiliser();

    cocher('.case-fiche');
    bouton('bouton-renvoyer').click();
    fixture.detectChanges();

    const renvoi = http.expectOne(`${API}/renvoi`);
    expect(renvoi.request.body).toEqual({ visiteIds: ['v-1'], motif: 'Code QR illisible' });
    renvoi.flush({
      nombreFiches: 1,
      nombreReussies: 1,
      nombreErreurs: 0,
      resultats: [{ index: 0, visiteId: 'v-1', resultat: 'RENVOYEE', code: 200 }],
    });
    repondreListe([fiche(2)]);
    await stabiliser();

    expect(element.querySelector('.resultats')!.textContent).toContain('Renvoyée');
  });

  it('dialogue annule : aucun appel', async () => {
    reponseDialogue = false;
    repondreListe([fiche(1)]);
    await stabiliser();

    cocher('.case-fiche');
    bouton('bouton-viser').click();
    fixture.detectChanges();
    http.expectNone(`${API}/visa`);
  });

  it('400 sur le visa : message et detail du serveur', async () => {
    repondreListe([fiche(1)]);
    await stabiliser();
    cocher('.case-fiche');
    bouton('bouton-viser').click();

    http.expectOne(`${API}/visa`).flush(
      {
        status: 400,
        erreur: 'Validation echouee',
        message: 'Un ou plusieurs champs sont invalides',
        details: ['visiteIds : au plus 50 fiches par requete'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await stabiliser();

    expect(element.querySelector('.erreur-action')!.textContent).toContain(
      'Un ou plusieurs champs sont invalides : visiteIds : au plus 50 fiches par requete',
    );
  });

  it('scan en 404 : l’erreur recue en blob est relue en JSON', async () => {
    repondreListe([fiche(1)]);
    await stabiliser();

    bouton('bouton-scan').click();
    const corps = new Blob(
      [
        JSON.stringify({
          status: 404,
          erreur: 'Ressource introuvable',
          message: 'Aucune fiche signee pour cette consultation',
        }),
      ],
      { type: 'application/json' },
    );
    http
      .expectOne(`${environment.api.fiche1}/api/consultations/v-1/fiche-signee`)
      .flush(corps, { status: 404, statusText: 'Not Found' });
    await stabiliser();
    await new Promise((r) => setTimeout(r));
    await stabiliser();

    expect(element.querySelector('.erreur-telechargement')!.textContent).toContain(
      'Aucune fiche signee pour cette consultation',
    );
  });

  it('403 sur la liste : message du serveur, sans redirection', async () => {
    http
      .expectOne((r) => r.url === API)
      .flush(
        {
          status: 403,
          erreur: 'Acces refuse',
          message: 'Votre role ne permet pas d acceder a cette ressource',
        },
        { status: 403, statusText: 'Forbidden' },
      );
    await stabiliser();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Votre role ne permet pas',
    );
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });
});
