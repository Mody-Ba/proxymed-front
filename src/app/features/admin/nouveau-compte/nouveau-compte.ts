import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { Router, RouterLink } from '@angular/router';
import {
  EMAIL_MAX,
  NOM_COMPLET_MAX,
  RoleCreable,
  ROLES_CREABLES,
} from '../../../core/models/admin.model';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AdminUtilisateurService } from '../../../core/services/admin-utilisateur.service';
import { detailsErreur, estEchecEnvoiEmail, messageErreur } from '../../../core/utils/erreur-http';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';

export const MESSAGE_COURRIEL_UTILISE = 'Un compte existe déjà avec cette adresse courriel.';
export const MESSAGE_ENVOI_ECHOUE =
  'Le courriel contenant le mot de passe temporaire n’a pas pu être envoyé : le compte n’a pas été créé. Vérifiez l’adresse puis réessayez.';

export function messageCompteCree(email: string): string {
  return `Le compte a été créé. Un mot de passe temporaire a été envoyé par courriel à ${email}.`;
}

/**
 * Creation d'un compte medecin. Aucun mot de passe n'est saisi ni affiche : le serveur genere
 * un mot de passe temporaire et l'envoie lui-meme par courriel.
 */
@Component({
  selector: 'app-nouveau-compte',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    Encadre,
    EntetePage,
  ],
  templateUrl: './nouveau-compte.html',
  styleUrl: './nouveau-compte.scss',
})
export class NouveauCompte {
  private readonly comptes = inject(AdminUtilisateurService);
  private readonly router = inject(Router);

  protected readonly nomCompletMax = NOM_COMPLET_MAX;
  protected readonly emailMax = EMAIL_MAX;
  protected readonly roles = ROLES_CREABLES;
  protected readonly libellesRole = LIBELLES_ROLE;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    nomComplet: ['', [Validators.required, nonVide, Validators.maxLength(NOM_COMPLET_MAX)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX)]],
    role: ['' as RoleCreable | '', Validators.required],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);
  /** 503 : rien n'a ete enregistre, le meme envoi peut etre retente. */
  protected readonly envoiEchoue = signal(false);

  protected creer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.details.set([]);
    this.envoiEchoue.set(false);

    const { nomComplet, email, role } = this.formulaire.getRawValue();
    this.comptes
      .creer({
        nomComplet: nomComplet.trim(),
        email: email.trim(),
        role: role as RoleCreable,
      })
      .subscribe({
        next: (compte) => {
          this.enCours.set(false);
          this.comptes.annoncerSurListe(messageCompteCree(compte.email));
          void this.router.navigateByUrl('/admin/comptes');
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          if (erreur instanceof HttpErrorResponse && erreur.status === 409) {
            this.erreur.set(MESSAGE_COURRIEL_UTILISE);
            this.formulaire.controls.email.setErrors({ dejaUtilise: true });
            this.formulaire.controls.email.markAsTouched();
          } else if (estEchecEnvoiEmail(erreur)) {
            this.envoiEchoue.set(true);
            this.erreur.set(MESSAGE_ENVOI_ECHOUE);
          } else {
            this.erreur.set(messageErreur(erreur, 'Le compte n’a pas pu être créé.'));
            this.details.set(detailsErreur(erreur));
          }
        },
      });
  }
}
