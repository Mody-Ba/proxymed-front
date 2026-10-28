import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Role } from '../models/role.model';
import { AuthService } from '../services/auth.service';
import { authGuard, connecteGuard, inviteGuard, roleGuard } from './auth.guards';

describe('gardes', () => {
  const connecte = signal(false);
  const role = signal<Role | null>(null);
  const motDePasseTemporaire = signal(false);

  const authFactice = {
    estConnecte: computed(() => connecte()),
    role: computed(() => role()),
    motDePasseTemporaire: computed(() => motDePasseTemporaire()),
    urlAccueil: () => (motDePasseTemporaire() ? '/changer-mot-de-passe' : '/senior'),
  };

  function etat(estConnecte: boolean, r: Role | null = null, temporaire = false): void {
    connecte.set(estConnecte);
    role.set(r);
    motDePasseTemporaire.set(temporaire);
  }

  function executer(garde: CanActivateFn): string | true {
    const resultat = TestBed.runInInjectionContext(() =>
      garde({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return resultat instanceof UrlTree ? resultat.toString() : (resultat as true);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authFactice }],
    });
  });

  describe('non connecte', () => {
    beforeEach(() => etat(false));

    it('authGuard renvoie vers /connexion', () => {
      expect(executer(authGuard)).toBe('/connexion');
    });

    it('roleGuard renvoie vers /connexion', () => {
      expect(executer(roleGuard('ADMIN'))).toBe('/connexion');
    });

    it('connecteGuard renvoie vers /connexion', () => {
      expect(executer(connecteGuard)).toBe('/connexion');
    });

    it('inviteGuard laisse afficher la page de connexion', () => {
      expect(executer(inviteGuard)).toBe(true);
    });
  });

  describe('mauvais role', () => {
    it('roleGuard renvoie vers /acces-refuse', () => {
      etat(true, 'MEDECIN_JUNIOR');
      expect(executer(roleGuard('MEDECIN_SENIOR'))).toBe('/acces-refuse');
    });

    it('un patient ne passe pas la garde admin', () => {
      etat(true, 'UTILISATEUR');
      expect(executer(roleGuard('ADMIN'))).toBe('/acces-refuse');
    });

    it('le bon role passe', () => {
      etat(true, 'MEDECIN_SENIOR');
      expect(executer(roleGuard('MEDECIN_SENIOR'))).toBe(true);
    });
  });

  describe('mot de passe temporaire', () => {
    beforeEach(() => etat(true, 'MEDECIN_SENIOR', true));

    it('roleGuard renvoie vers /changer-mot-de-passe, meme avec le bon role', () => {
      expect(executer(roleGuard('MEDECIN_SENIOR'))).toBe('/changer-mot-de-passe');
    });

    it('authGuard renvoie vers /changer-mot-de-passe', () => {
      expect(executer(authGuard)).toBe('/changer-mot-de-passe');
    });

    it('connecteGuard laisse acceder a /changer-mot-de-passe', () => {
      expect(executer(connecteGuard)).toBe(true);
    });

    it('inviteGuard renvoie vers /changer-mot-de-passe', () => {
      expect(executer(inviteGuard)).toBe('/changer-mot-de-passe');
    });
  });

  it('inviteGuard renvoie un compte connecte vers son accueil', () => {
    etat(true, 'MEDECIN_SENIOR');
    expect(executer(inviteGuard)).toBe('/senior');
  });
});
