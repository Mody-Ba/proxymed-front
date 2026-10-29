import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Role } from '../../../core/models/role.model';
import { BarreNavigation } from './barre-navigation';

const CLE_SESSION = 'proxymed.session';

describe('BarreNavigation', () => {
  function afficher(role: Role, motDePasseTemporaire = false): HTMLElement {
    sessionStorage.setItem(
      CLE_SESSION,
      JSON.stringify({
        badge: 'badge',
        role,
        email: 'compte@proxymed.fr',
        expireLe: Date.now() + 3_600_000,
        motDePasseTemporaire,
      }),
    );
    TestBed.configureTestingModule({
      imports: [BarreNavigation],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(BarreNavigation);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('montre "Nouvelle demande" et "Mes demandes" au patient', () => {
    const element = afficher('UTILISATEUR');
    const liens = Array.from(element.querySelectorAll('.liens a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href'),
    ]);

    expect(liens).toEqual([
      ['Nouvelle demande', '/patient/nouvelle-demande'],
      ['Mes demandes', '/patient/mes-demandes'],
    ]);
  });

  it.each([
    ['MEDECIN_SENIOR', [['Demandes', '/senior/demandes']]],
    ['MEDECIN_JUNIOR', [['Demandes assignées', '/junior/demandes']]],
  ] as const)('montre au role %s ses seuls liens', (role, attendus) => {
    const liens = Array.from(afficher(role).querySelectorAll('.liens a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href'),
    ]);

    expect(liens).toEqual(attendus);
  });

  it("montre a l'administrateur les comptes seulement, aucun lien medical", () => {
    const liens = Array.from(afficher('ADMIN').querySelectorAll('.liens a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href'),
    ]);

    expect(liens).toEqual([
      ['Comptes', '/admin/comptes'],
      ['Créer un médecin', '/admin/comptes/nouveau'],
    ]);
  });

  it('masque les liens tant que le mot de passe est temporaire', () => {
    expect(afficher('UTILISATEUR', true).querySelector('.liens')).toBeNull();
  });
});
