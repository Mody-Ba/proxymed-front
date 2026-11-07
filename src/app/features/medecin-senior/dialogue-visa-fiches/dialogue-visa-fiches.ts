import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DonneesDecisionFiches {
  nombre: number;
}

export function texteConfirmationVisa(nombre: number): string {
  return nombre > 1
    ? `Vous allez viser ${nombre} fiches. Chaque visa est enregistré à votre nom.`
    : 'Vous allez viser 1 fiche. Le visa est enregistré à votre nom.';
}

/** Confirmation du visa en lot : se ferme sur true, l'appel est fait par la page. */
@Component({
  selector: 'app-dialogue-visa-fiches',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Viser la sélection</h2>
    <mat-dialog-content>
      <p class="contexte texte-confirmation">{{ texte }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Annuler</button>
      <button
        mat-flat-button
        type="button"
        class="bouton-principal confirmer-visa"
        cdkFocusInitial
        [mat-dialog-close]="true"
      >
        <mat-icon fontIcon="verified" aria-hidden="true" />Viser {{ donnees.nombre }} fiche{{
          donnees.nombre > 1 ? 's' : ''
        }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: '../../../shared/styles/dialogue.scss',
})
export class DialogueVisaFiches {
  protected readonly donnees = inject<DonneesDecisionFiches>(MAT_DIALOG_DATA);
  protected readonly texte = texteConfirmationVisa(this.donnees.nombre);
}
