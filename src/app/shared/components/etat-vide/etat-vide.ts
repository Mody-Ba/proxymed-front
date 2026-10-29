import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Etat vide d'une liste : grande icone, titre, texte et actions projetees. */
@Component({
  selector: 'app-etat-vide',
  imports: [MatIconModule],
  templateUrl: './etat-vide.html',
  styleUrl: './etat-vide.scss',
})
export class EtatVide {
  readonly icone = input('inbox');
  readonly titre = input.required<string>();
  readonly texte = input<string | null>(null);
}
