import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, map, Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChangementMotDePasseRequest,
  ConnexionRequest,
  ConnexionResponse,
  UtilisateurResponse,
} from '../models/auth.model';
import { ACCUEIL_PAR_ROLE, Role } from '../models/role.model';

/** Ce qui est garde dans sessionStorage : efface a la fermeture de l'onglet. */
interface Session {
  badge: string;
  role: Role;
  email: string;
  /** Instant d'expiration (ms epoch), calcule a la reception avec expireDansSecondes. */
  expireLe: number;
  motDePasseTemporaire: boolean;
}

const CLE_SESSION = 'proxymed.session';
/** setTimeout n'accepte pas de delai au-dela de 2^31 - 1 ms. */
const DELAI_MAX = 2_147_483_647;
const MESSAGE_EXPIRATION = 'Votre session a expiré. Veuillez vous reconnecter.';

/**
 * Etat de connexion de l'application.
 * Le role connu ici sert seulement a l'affichage : c'est le serveur qui protege les donnees.
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly urlAuth = `${environment.api.auth}/api/auth`;

  private readonly session = signal<Session | null>(null);
  private readonly _compte = signal<UtilisateurResponse | null>(null);
  private readonly _messageConnexion = signal<string | null>(null);
  private minuteurExpiration: ReturnType<typeof setTimeout> | null = null;

  readonly compte = this._compte.asReadonly();
  readonly estConnecte = computed(() => this.session() !== null);
  readonly role = computed(() => this.session()?.role ?? null);
  readonly badge = computed(() => this.session()?.badge ?? null);
  readonly motDePasseTemporaire = computed(() => this.session()?.motDePasseTemporaire ?? false);
  readonly nomAffiche = computed(() => this._compte()?.nomComplet || this.session()?.email || '');
  /** Message a afficher sur la page de connexion (session expiree, badge refuse...). */
  readonly messageConnexion = this._messageConnexion.asReadonly();

  constructor() {
    this.restaurerSession();
  }

  ngOnDestroy(): void {
    this.arreterMinuteur();
  }

  /** Connecte, garde le badge, puis charge le compte (nom complet). */
  connexion(identifiants: ConnexionRequest): Observable<UtilisateurResponse> {
    return this.http.post<ConnexionResponse>(`${this.urlAuth}/connexion`, identifiants).pipe(
      tap((reponse) => {
        this._messageConnexion.set(null);
        this.ouvrirSession({
          badge: reponse.accessToken,
          role: reponse.role,
          email: reponse.email,
          expireLe: Date.now() + reponse.expireDansSecondes * 1000,
          motDePasseTemporaire: reponse.motDePasseTemporaire,
        });
      }),
      switchMap(() => this.chargerCompte()),
    );
  }

  chargerCompte(): Observable<UtilisateurResponse> {
    return this.http.get<UtilisateurResponse>(`${this.urlAuth}/moi`).pipe(
      tap((compte) => {
        this._compte.set(compte);
        this.mettreAJourSession({
          role: compte.role,
          motDePasseTemporaire: compte.motDePasseTemporaire,
        });
      }),
    );
  }

  /** Au demarrage : recharge le compte d'une session restauree. Ne bloque jamais l'application. */
  initialiser(): Promise<void> {
    if (!this.estConnecte()) {
      return Promise.resolve();
    }
    return firstValueFrom(this.chargerCompte().pipe(map(() => undefined))).catch(() => undefined);
  }

  changerMotDePasse(demande: ChangementMotDePasseRequest): Observable<void> {
    return this.http.post<void>(`${this.urlAuth}/changer-mot-de-passe`, demande).pipe(
      tap(() => {
        this.mettreAJourSession({ motDePasseTemporaire: false });
        this._compte.update((compte) =>
          compte ? { ...compte, motDePasseTemporaire: false } : compte,
        );
      }),
    );
  }

  /** Efface la session et renvoie vers /connexion, avec un message eventuel. */
  deconnexion(message: string | null = null): void {
    this.fermerSession();
    this._messageConnexion.set(message);
    void this.router.navigateByUrl('/connexion');
  }

  /** Message a afficher a la prochaine ouverture de /connexion (compte cree...). */
  preparerMessageConnexion(message: string): void {
    this._messageConnexion.set(message);
  }

  /** Lu une fois par la page de connexion. */
  consommerMessageConnexion(): string | null {
    const message = this._messageConnexion();
    this._messageConnexion.set(null);
    return message;
  }

  /** Page d'accueil du role connecte, ou /connexion. */
  urlAccueil(): string {
    const session = this.session();
    if (!session) {
      return '/connexion';
    }
    return session.motDePasseTemporaire ? '/changer-mot-de-passe' : ACCUEIL_PAR_ROLE[session.role];
  }

  private ouvrirSession(session: Session): void {
    this.session.set(session);
    this.ecrireStockage(session);
    this.programmerExpiration(session.expireLe);
  }

  private mettreAJourSession(modifications: Partial<Session>): void {
    const session = this.session();
    if (!session) {
      return;
    }
    const nouvelle = { ...session, ...modifications };
    this.session.set(nouvelle);
    this.ecrireStockage(nouvelle);
  }

  private fermerSession(): void {
    this.arreterMinuteur();
    this.session.set(null);
    this._compte.set(null);
    try {
      sessionStorage.removeItem(CLE_SESSION);
    } catch {
      // Stockage indisponible : rien a effacer.
    }
  }

  private restaurerSession(): void {
    let session: Session | null = null;
    try {
      const brut = sessionStorage.getItem(CLE_SESSION);
      session = brut ? (JSON.parse(brut) as Session) : null;
    } catch {
      session = null;
    }
    if (!session?.badge || !session.role || typeof session.expireLe !== 'number') {
      this.fermerSession();
      return;
    }
    if (session.expireLe <= Date.now()) {
      this.fermerSession();
      this._messageConnexion.set(MESSAGE_EXPIRATION);
      return;
    }
    this.session.set(session);
    this.programmerExpiration(session.expireLe);
  }

  private ecrireStockage(session: Session): void {
    try {
      sessionStorage.setItem(CLE_SESSION, JSON.stringify(session));
    } catch {
      // Stockage indisponible (navigation privee stricte) : la session reste en memoire.
    }
  }

  private programmerExpiration(expireLe: number): void {
    this.arreterMinuteur();
    const delai = Math.min(Math.max(expireLe - Date.now(), 0), DELAI_MAX);
    this.minuteurExpiration = setTimeout(() => {
      if (Date.now() < expireLe) {
        this.programmerExpiration(expireLe);
      } else {
        this.deconnexion(MESSAGE_EXPIRATION);
      }
    }, delai);
  }

  private arreterMinuteur(): void {
    if (this.minuteurExpiration !== null) {
      clearTimeout(this.minuteurExpiration);
      this.minuteurExpiration = null;
    }
  }
}
