import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MOTIF_REFUS_MAX } from '../../../core/models/demande-consultation.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { detailsErreur, estConflit, messageErreur } from '../../../core/utils/erreur-http';
import { nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { DonneesDecision, IssueDecision } from '../decision';

export const MESSAGE_DEMANDE_REFUSEE =
  'La demande a été refusée. Le patient verra le motif du refus dans son espace.';

/** Refus d'une demande : motif obligatoire, meme longueur maximale que le serveur. */
@Component({
  selector: 'app-dialogue-refus',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    Encadre,
  ],
  templateUrl: './dialogue-refus.html',
  styleUrl: '../dialogue-decision.scss',
})
export class DialogueRefus {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly dialogue = inject<MatDialogRef<DialogueRefus, IssueDecision>>(MatDialogRef);
  protected readonly donnees = inject<DonneesDecision>(MAT_DIALOG_DATA);

  protected readonly motifRefusMax = MOTIF_REFUS_MAX;
  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    motifRefus: ['', [Validators.required, nonVide, Validators.maxLength(MOTIF_REFUS_MAX)]],
  });
  protected readonly motifSaisi = toSignal(this.formulaire.controls.motifRefus.valueChanges, {
    initialValue: '',
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);

  protected refuser(): void {
    if (this.enCours()) {
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.dialogue.disableClose = true;
    this.erreur.set(null);
    this.details.set([]);

    const motifRefus = this.formulaire.getRawValue().motifRefus.trim();
    this.demandes.refuser(this.donnees.demandeId, motifRefus).subscribe({
      next: () => this.dialogue.close({ issue: 'decidee', message: MESSAGE_DEMANDE_REFUSEE }),
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.dialogue.disableClose = false;
        if (estConflit(erreur)) {
          this.dialogue.close({ issue: 'conflit' });
          return;
        }
        this.erreur.set(messageErreur(erreur, 'La demande n’a pas pu être refusée.'));
        this.details.set(detailsErreur(erreur));
      },
    });
  }
}
