import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UtilisateurResponse } from '../models/auth.model';
import {
  InscriptionEnAttenteResponse,
  InscriptionRequest,
  VerificationRequest,
} from '../models/inscription.model';

/**
 * Inscription en cours, gardee en memoire seulement (perdue au rechargement : il suffit de
 * recommencer). Ne contient jamais le mot de passe ni le code.
 */
export interface InscriptionEnCours {
  email: string;
  /** Instant (ms epoch, horloge du navigateur) a partir duquel un nouveau code peut etre demande. */
  renvoiPossibleLe: number;
}

/** Delai minimal entre deux envois de code, identique a DELAI_ENTRE_ENVOIS du serveur. */
export const DELAI_RENVOI_SECONDES = 60;
/** Duree de validite du code, identique a VALIDITE_CODE du serveur. */
export const VALIDITE_CODE_MINUTES = 10;

/** Message du serveur apres le 5e code faux (CodeVerificationException, 400). */
const MARQUEUR_ESSAIS_EPUISES = "nombre maximal d'essais";

/**
 * Inscription d'un patient ou d'un proche en deux temps : formulaire puis code recu par email.
 * Les trois appels sont publics ; toutes les regles (format, delais, essais) sont verifiees par
 * le serveur, le front ne fait que les afficher.
 */
@Injectable({ providedIn: 'root' })
export class InscriptionService {
  private readonly http = inject(HttpClient);
  private readonly urlAuth = `${environment.api.auth}/api/auth`;

  private readonly _enCours = signal<InscriptionEnCours | null>(null);
  private readonly _messageInscription = signal<string | null>(null);

  readonly enCours = this._enCours.asReadonly();
  readonly email = computed(() => this._enCours()?.email ?? null);

  /**
   * Le mot de passe part dans la requete et n'est garde nulle part : seuls l'email et l'heure
   * du prochain renvoi possible sont retenus.
   */
  inscrire(demande: InscriptionRequest): Observable<InscriptionEnAttenteResponse> {
    return this.http
      .post<InscriptionEnAttenteResponse>(`${this.urlAuth}/inscription`, demande)
      .pipe(tap((reponse) => this.demarrer(reponse.email)));
  }

  verifier(code: string): Observable<UtilisateurResponse> {
    const demande: VerificationRequest = { email: this.emailObligatoire(), code };
    return this.http
      .post<UtilisateurResponse>(`${this.urlAuth}/verification`, demande)
      .pipe(tap(() => this.abandonner()));
  }

  renvoyerCode(): Observable<InscriptionEnAttenteResponse> {
    return this.http
      .post<InscriptionEnAttenteResponse>(`${this.urlAuth}/renvoyer-code`, {
        email: this.emailObligatoire(),
      })
      .pipe(tap((reponse) => this.demarrer(reponse.email)));
  }

  /**
   * Apres un 429, le serveur indique dans Retry-After quand redemander un code : le compte a
   * rebours repart de cette valeur.
   */
  reporterRenvoi(secondes: number): void {
    this._enCours.update((enCours) =>
      enCours ? { ...enCours, renvoiPossibleLe: Date.now() + secondes * 1000 } : enCours,
    );
  }

  /**
   * L'inscription en attente n'existe plus sur le serveur : 5e code faux (400) ou inscription
   * introuvable (404). Il faut recommencer depuis /inscription.
   */
  estInscriptionAnnulee(erreur: unknown): boolean {
    if (!(erreur instanceof HttpErrorResponse)) {
      return false;
    }
    if (erreur.status === 404) {
      return true;
    }
    const message: unknown = erreur.error?.message;
    return (
      erreur.status === 400 &&
      typeof message === 'string' &&
      message.toLowerCase().includes(MARQUEUR_ESSAIS_EPUISES)
    );
  }

  /** Oublie l'inscription en cours ; un message eventuel sera affiche sur /inscription. */
  abandonner(message: string | null = null): void {
    this._enCours.set(null);
    this._messageInscription.set(message);
  }

  /** Lu une fois par la page d'inscription. */
  consommerMessageInscription(): string | null {
    const message = this._messageInscription();
    this._messageInscription.set(null);
    return message;
  }

  private demarrer(email: string): void {
    this._messageInscription.set(null);
    this._enCours.set({ email, renvoiPossibleLe: Date.now() + DELAI_RENVOI_SECONDES * 1000 });
  }

  private emailObligatoire(): string {
    const email = this.email();
    if (!email) {
      throw new Error('Aucune inscription en cours');
    }
    return email;
  }
}
