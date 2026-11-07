import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MOTIF_RENVOI_MAX } from '../../../core/models/visa-fiche.model';
import { erreurMotifRenvoi } from '../../../core/utils/visa-fiches';
import { DonneesDecisionFiches } from '../dialogue-visa-fiches/dialogue-visa-fiches';

/** Motif obligatoire (pas seulement des espaces) et 1000 caracteres au plus, comme le serveur. */
export const motifRenvoiValide: ValidatorFn = (
  controle: AbstractControl,
): ValidationErrors | null => {
  const message = erreurMotifRenvoi(controle.value as string);
  return message ? { motif: message } : null;
};

/** Renvoi en lot : se ferme sur le motif saisi (sans espaces autour), l'appel est fait par la page. */
@Component({
  selector: 'app-dialogue-renvoi-fiches',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './dialogue-renvoi-fiches.html',
  styleUrl: '../../../shared/styles/dialogue.scss',
})
export class DialogueRenvoiFiches {
  private readonly dialogue = inject<MatDialogRef<DialogueRenvoiFiches, string>>(MatDialogRef);
  protected readonly donnees = inject<DonneesDecisionFiches>(MAT_DIALOG_DATA);

  protected readonly motifMax = MOTIF_RENVOI_MAX;
  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    motif: ['', [motifRenvoiValide]],
  });
  protected readonly motifSaisi = toSignal(this.formulaire.controls.motif.valueChanges, {
    initialValue: '',
  });

  protected messageErreurMotif(): string | null {
    return (this.formulaire.controls.motif.errors?.['motif'] as string | undefined) ?? null;
  }

  protected renvoyer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.dialogue.close(this.formulaire.getRawValue().motif.trim());
  }
}
