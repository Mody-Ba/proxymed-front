import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Carte d'une information : icone decorative, libelle et valeur projetee.
 * <app-carte-info icone="person" libelle="Patient">Awa Diallo</app-carte-info>
 */
@Component({
  selector: 'app-carte-info',
  imports: [MatIconModule],
  templateUrl: './carte-info.html',
  styleUrl: './carte-info.scss',
  host: { '[class.large]': 'large()' },
})
export class CarteInfo {
  readonly icone = input.required<string>();
  readonly libelle = input.required<string>();
  /** Occupe toute la largeur de la grille (texte long). */
  readonly large = input(false);
}
