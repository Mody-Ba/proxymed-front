import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MedecinJuniorResponse } from '../../../core/models/medecin.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { MedecinService } from '../../../core/services/medecin.service';
import { detailsErreur, estConflit, messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { DonneesDecision, IssueDecision } from '../decision';

export const MESSAGE_AUCUN_JUNIOR =
  'Aucun médecin junior actif n’est disponible : la demande ne peut pas être acceptée pour le moment.';

/**
 * Acceptation d'une demande : choix obligatoire du medecin junior. Le nom est affiche,
 * seul l'identifiant part au serveur ; le senior vient du badge.
 */
@Component({
  selector: 'app-dialogue-acceptation',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    Encadre,
  ],
  templateUrl: './dialogue-acceptation.html',
  styleUrl: '../../../shared/styles/dialogue.scss',
})
export class DialogueAcceptation implements OnInit {
  private readonly medecins = inject(MedecinService);
  private readonly demandes = inject(DemandeConsultationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogue =
    inject<MatDialogRef<DialogueAcceptation, IssueDecision>>(MatDialogRef);
  protected readonly donnees = inject<DonneesDecision>(MAT_DIALOG_DATA);

  protected readonly messageAucunJunior = MESSAGE_AUCUN_JUNIOR;
  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    juniorId: ['', Validators.required],
  });

  protected readonly juniors = signal<MedecinJuniorResponse[]>([]);
  protected readonly chargementJuniors = signal(true);
  protected readonly erreurJuniors = signal<string | null>(null);

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);

  ngOnInit(): void {
    this.chargerJuniors();
  }

  protected chargerJuniors(): void {
    this.chargementJuniors.set(true);
    this.erreurJuniors.set(null);
    const abonnement = this.medecins.juniors().subscribe({
      next: (juniors) => {
        this.chargementJuniors.set(false);
        this.juniors.set(juniors);
      },
      error: (erreur: unknown) => {
        this.chargementJuniors.set(false);
        this.erreurJuniors.set(
          messageErreur(erreur, 'La liste des médecins juniors n’a pas pu être chargée.'),
        );
      },
    });
    this.destroyRef.onDestroy(() => abonnement.unsubscribe());
  }

  protected accepter(): void {
    if (this.enCours() || !this.juniors().length) {
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const { juniorId } = this.formulaire.getRawValue();
    const junior = this.juniors().find((j) => j.id === juniorId);
    this.enCours.set(true);
    this.dialogue.disableClose = true;
    this.erreur.set(null);
    this.details.set([]);

    this.demandes.accepter(this.donnees.demandeId, juniorId).subscribe({
      next: () => {
        this.dialogue.close({
          issue: 'decidee',
          message: `La demande a été acceptée et assignée à ${junior?.nomComplet ?? 'un médecin junior'}.`,
        });
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.dialogue.disableClose = false;
        if (estConflit(erreur)) {
          this.dialogue.close({ issue: 'conflit' });
          return;
        }
        this.erreur.set(messageErreur(erreur, 'La demande n’a pas pu être acceptée.'));
        this.details.set(detailsErreur(erreur));
      },
    });
  }
}
