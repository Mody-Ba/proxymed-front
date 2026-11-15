import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { FicheAViserResponse } from '../../../core/models/visa-fiche.model';
import { FichesVisees } from './fiches-visees';

const API = `${environment.api.fiche1}/api/fiches-signees`;

function fiche(n: number, extra: Partial<FicheAViserResponse> = {}): FicheAViserResponse {
  return {
    ficheId: `f-${n}`,
    visiteId: `v-${n}`,
    patientId: `p-${n}`,
    nomPatient: `Patient ${n}`,
    typeVisite: 'INITIALE',
    dateImport: '2026-11-01T10:00:00Z',
    statut: 'VISEE',
    dateVisa: '2026-11-02T10:00:00Z',
    nomSeniorVisa: 'senior@proxymed.test',
    ...extra,
  };
}

describe('FichesVisees', () => {
  it('affiche la fréquence des visites, ou « Non précisée »', async () => {
    TestBed.configureTestingModule({
      imports: [FichesVisees],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FichesVisees);
    fixture.detectChanges();

    const requete = http.expectOne((r) => r.url === API && r.method === 'GET');
    expect(requete.request.params.get('statut')).toBe('VISEE');
    requete.flush({
      elements: [
        fiche(1, { frequenceVisitesSenior: 'BIMENSUELLE' }),
        fiche(2),
        fiche(3, { typeVisite: 'ROUTINE' }),
      ],
      page: 0,
      taille: 20,
      totalElements: 3,
      totalPages: 1,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const cellules = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('td.cellule-frequence'),
    ].map((c) => c.textContent!.trim());
    expect(cellules).toEqual(['Bimensuelle', 'Non précisée', 'Non précisée']);
    http.verify();
  });
});
