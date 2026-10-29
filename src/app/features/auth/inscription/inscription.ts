import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { InscriptionService } from '../../../core/services/inscription.service';
import { detailsErreur, messageErreur } from '../../../core/utils/erreur-http';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';

/** La confirmation doit reprendre le mot de passe. */
const confirmationIdentique: ValidatorFn = (groupe: AbstractControl): ValidationErrors | null => {
  const motDePasse = groupe.get('motDePasse')?.value;
  const confirmation = groupe.get('confirmation')?.value;
  return confirmation && motDePasse !== confirmation ? { confirmationDifferente: true } : null;
};

@Component({
  selector: 'app-inscription',
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
  templateUrl: './inscription.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class Inscription {
  private readonly inscription = inject(InscriptionService);
  private readonly router = inject(Router);

  protected readonly formulaire = inject(NonNullableFormBuilder).group(
    {
      nomComplet: ['', [Validators.required, nonVide, Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      motDePasse: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmation: ['', [Validators.required]],
    },
    { validators: confirmationIdentique },
  );

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);
  protected readonly motDePasseVisible = signal(false);
  /** Message laisse par la page de verification (inscription annulee...). */
  protected readonly information = signal(this.inscription.consommerMessageInscription());

  protected basculerVisibilite(): void {
    this.motDePasseVisible.update((visible) => !visible);
  }

  protected sInscrire(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.details.set([]);
    this.information.set(null);

    const { nomComplet, email, motDePasse } = this.formulaire.getRawValue();
    // Le mot de passe n'est conserve nulle part : il quitte le formulaire apres l'envoi.
    this.inscription.inscrire({ nomComplet: nomComplet.trim(), email, motDePasse }).subscribe({
      next: () => {
        this.enCours.set(false);
        this.formulaire.reset();
        void this.router.navigateByUrl('/verification');
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur));
        this.details.set(detailsErreur(erreur));
        this.formulaire.controls.motDePasse.reset();
        this.formulaire.controls.confirmation.reset();
      },
    });
  }
}
