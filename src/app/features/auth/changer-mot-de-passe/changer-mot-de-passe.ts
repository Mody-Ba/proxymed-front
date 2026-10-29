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
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { detailsErreur, messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';

/** La confirmation doit reprendre le nouveau mot de passe. */
const confirmationIdentique: ValidatorFn = (groupe: AbstractControl): ValidationErrors | null => {
  const nouveau = groupe.get('nouveauMotDePasse')?.value;
  const confirmation = groupe.get('confirmation')?.value;
  return confirmation && nouveau !== confirmation ? { confirmationDifferente: true } : null;
};

@Component({
  selector: 'app-changer-mot-de-passe',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    Encadre,
  ],
  templateUrl: './changer-mot-de-passe.html',
  styleUrl: '../auth-formulaire.scss',
  host: { class: 'page-auth' },
})
export class ChangerMotDePasse {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly formulaire = inject(NonNullableFormBuilder).group(
    {
      ancienMotDePasse: ['', [Validators.required, Validators.maxLength(72)]],
      nouveauMotDePasse: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      ],
      confirmation: ['', [Validators.required]],
    },
    { validators: confirmationIdentique },
  );

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);

  protected changer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.details.set([]);

    const { ancienMotDePasse, nouveauMotDePasse } = this.formulaire.getRawValue();
    this.auth.changerMotDePasse({ ancienMotDePasse, nouveauMotDePasse }).subscribe({
      next: () => {
        this.enCours.set(false);
        void this.router.navigateByUrl(this.auth.urlAccueil());
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(erreur));
        this.details.set(detailsErreur(erreur));
      },
    });
  }
}
