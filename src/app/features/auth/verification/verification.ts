import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  DELAI_RENVOI_SECONDES,
  InscriptionService,
  VALIDITE_CODE_MINUTES,
} from '../../../core/services/inscription.service';
import { detailsErreur, messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';

export const MESSAGE_COMPTE_CREE = 'Votre compte est créé, vous pouvez vous connecter.';

@Component({
  selector: 'app-verification',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    Encadre,
  ],
  templateUrl: './verification.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class Verification {
  private readonly auth = inject(AuthService);
  private readonly inscription = inject(InscriptionService);
  private readonly router = inject(Router);

  protected readonly validiteMinutes = VALIDITE_CODE_MINUTES;
  /** Garde inscriptionEnCoursGuard : une inscription est toujours en cours a l'ouverture. */
  protected readonly email = this.inscription.email;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly enCours = signal(false);
  protected readonly renvoiEnCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);
  protected readonly information = signal<string | null>(null);

  /** Horloge du compte a rebours, rafraichie chaque seconde. */
  private readonly maintenant = signal(Date.now());
  protected readonly secondesAvantRenvoi = computed(() => {
    const renvoiPossibleLe = this.inscription.enCours()?.renvoiPossibleLe ?? 0;
    return Math.max(0, Math.ceil((renvoiPossibleLe - this.maintenant()) / 1000));
  });

  constructor() {
    const minuteur = setInterval(() => this.maintenant.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(minuteur));
  }

  protected valider(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.effacerMessages();

    this.inscription.verifier(this.formulaire.getRawValue().code).subscribe({
      next: () => {
        this.enCours.set(false);
        this.auth.preparerMessageConnexion(MESSAGE_COMPTE_CREE);
        void this.router.navigateByUrl('/connexion');
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        if (!this.recommencerSiAnnulee(erreur)) {
          this.afficherErreur(erreur);
          this.formulaire.controls.code.reset();
        }
      },
    });
  }

  protected renvoyer(): void {
    if (this.secondesAvantRenvoi() > 0 || this.renvoiEnCours()) {
      return;
    }
    this.renvoiEnCours.set(true);
    this.effacerMessages();

    this.inscription.renvoyerCode().subscribe({
      next: (reponse) => {
        this.renvoiEnCours.set(false);
        this.maintenant.set(Date.now());
        this.formulaire.controls.code.reset();
        this.information.set(reponse.message || 'Un nouveau code vous a été envoyé.');
      },
      error: (erreur: unknown) => {
        this.renvoiEnCours.set(false);
        if (this.recommencerSiAnnulee(erreur)) {
          return;
        }
        if (erreur instanceof HttpErrorResponse && erreur.status === 429) {
          const attente = Number(erreur.headers.get('Retry-After'));
          this.inscription.reporterRenvoi(attente > 0 ? attente : DELAI_RENVOI_SECONDES);
          this.maintenant.set(Date.now());
        }
        this.afficherErreur(erreur);
      },
    });
  }

  /** 5e code faux ou inscription introuvable : retour a /inscription avec le message du serveur. */
  private recommencerSiAnnulee(erreur: unknown): boolean {
    if (!this.inscription.estInscriptionAnnulee(erreur)) {
      return false;
    }
    this.inscription.abandonner(
      messageErreur(erreur, 'Votre inscription a été annulée. Veuillez vous inscrire à nouveau.'),
    );
    void this.router.navigateByUrl('/inscription');
    return true;
  }

  private afficherErreur(erreur: unknown): void {
    this.erreur.set(messageErreur(erreur));
    this.details.set(detailsErreur(erreur));
  }

  private effacerMessages(): void {
    this.erreur.set(null);
    this.details.set([]);
    this.information.set(null);
  }
}
