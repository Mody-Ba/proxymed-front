import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { UtilisateurResponse } from '../../../core/models/auth.model';
import { AdminUtilisateurService } from '../../../core/services/admin-utilisateur.service';
import { estEchecEnvoiEmail, messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';

export type ActionCompte = 'activation' | 'reinitialisation';

export interface DonneesActionCompte {
  compte: UtilisateurResponse;
  action: ActionCompte;
}

/** Valeur de fermeture apres succes (undefined = annule). */
export interface IssueActionCompte {
  message: string;
}

export const MESSAGE_ENVOI_IMPOSSIBLE =
  'Le courriel n’a pas pu être envoyé : le mot de passe n’a pas été réinitialisé et l’ancien reste valable. Réessayez plus tard.';

interface Texte {
  titre: string;
  bouton: string;
  icone: string;
  enCours: string;
}

/**
 * Confirmation d'une action sur un compte (activer / desactiver, reinitialiser le mot de passe),
 * qui rappelle le nom du compte. L'appel part d'ici : une erreur (400, 503...) reste affichee
 * dans le dialogue. Le mot de passe temporaire n'est jamais affiche : le serveur ne le renvoie pas.
 */
@Component({
  selector: 'app-dialogue-action-compte',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, Encadre],
  templateUrl: './dialogue-action-compte.html',
  styleUrl: '../../../shared/styles/dialogue.scss',
})
export class DialogueActionCompte {
  private readonly comptes = inject(AdminUtilisateurService);
  private readonly dialogue =
    inject<MatDialogRef<DialogueActionCompte, IssueActionCompte>>(MatDialogRef);
  protected readonly donnees = inject<DonneesActionCompte>(MAT_DIALOG_DATA);

  protected readonly compte = this.donnees.compte;
  /** Pour l'activation : l'etat demande est l'inverse de l'etat actuel. */
  protected readonly desactivation = this.donnees.action === 'activation' && this.compte.actif;

  protected readonly texte = this.choisirTexte();

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected confirmer(): void {
    if (this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.dialogue.disableClose = true;
    this.erreur.set(null);

    const nom = this.compte.nomComplet;
    let appel: Observable<UtilisateurResponse>;
    let message: string;
    if (this.donnees.action === 'reinitialisation') {
      appel = this.comptes.reinitialiserMotDePasse(this.compte.id);
      message = `Un nouveau mot de passe temporaire a été envoyé par courriel à ${nom}.`;
    } else {
      appel = this.comptes.changerActivation(this.compte.id, !this.compte.actif);
      message = this.desactivation
        ? `Le compte de ${nom} a été désactivé : il ne peut plus se connecter.`
        : `Le compte de ${nom} a été activé : il peut de nouveau se connecter.`;
    }

    appel.subscribe({
      next: () => this.dialogue.close({ message }),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.dialogue.disableClose = false;
        this.erreur.set(
          estEchecEnvoiEmail(erreur)
            ? MESSAGE_ENVOI_IMPOSSIBLE
            : messageErreur(erreur, 'L’action n’a pas pu être effectuée.'),
        );
      },
    });
  }

  private choisirTexte(): Texte {
    if (this.donnees.action === 'reinitialisation') {
      return {
        titre: 'Réinitialiser le mot de passe ?',
        bouton: 'Réinitialiser',
        icone: 'lock_reset',
        enCours: 'Réinitialisation en cours',
      };
    }
    return this.desactivation
      ? {
          titre: 'Désactiver le compte ?',
          bouton: 'Désactiver',
          icone: 'person_off',
          enCours: 'Désactivation en cours',
        }
      : {
          titre: 'Activer le compte ?',
          bouton: 'Activer',
          icone: 'how_to_reg',
          enCours: 'Activation en cours',
        };
  }
}
