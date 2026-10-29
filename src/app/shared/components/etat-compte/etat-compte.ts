import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Pastille d'etat d'un compte : icone ET libelle "Actif" / "Désactivé", la couleur ne fait
 * qu'appuyer (styles .pastille-statut dans styles.scss).
 */
@Component({
  selector: 'app-etat-compte',
  imports: [MatIconModule],
  template: `<span [class]="'pastille-statut ' + (actif() ? 'etat-actif' : 'etat-desactive')"
    ><mat-icon [fontIcon]="actif() ? 'check_circle' : 'block'" aria-hidden="true" />{{
      actif() ? 'Actif' : 'Désactivé'
    }}</span
  >`,
})
export class EtatCompte {
  readonly actif = input.required<boolean>();
}
