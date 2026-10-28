import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { detailsErreur, messageErreur } from '../../../core/utils/erreur-http';

@Component({
  selector: 'app-connexion',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './connexion.html',
  styleUrl: '../auth-formulaire.scss',
})
export class Connexion {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    motDePasse: ['', [Validators.required, Validators.maxLength(72)]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);
  /** Message laisse par une deconnexion automatique (session expiree, badge refuse). */
  protected readonly information = signal(this.auth.consommerMessageConnexion());

  protected seConnecter(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.details.set([]);
    this.information.set(null);

    this.auth.connexion(this.formulaire.getRawValue()).subscribe({
      next: () => {
        this.enCours.set(false);
        void this.router.navigateByUrl(this.auth.urlAccueil());
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur));
        this.details.set(detailsErreur(erreur));
        this.formulaire.controls.motDePasse.reset();
      },
    });
  }
}
