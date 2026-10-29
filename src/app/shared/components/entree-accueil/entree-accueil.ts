import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/** Grande carte-lien d'une page d'accueil : icone decorative, titre, texte et chevron. */
@Component({
  selector: 'app-entree-accueil',
  imports: [MatIconModule, RouterLink],
  template: `<a class="entree" [routerLink]="lien()">
    <span class="icone-entree" aria-hidden="true">
      <mat-icon [fontIcon]="icone()" aria-hidden="true" />
    </span>
    <span class="textes">
      <span class="titre-entree">{{ titre() }}</span>
      <span class="texte-entree">{{ texte() }}</span>
    </span>
    <mat-icon class="chevron" fontIcon="chevron_right" aria-hidden="true" />
  </a>`,
  styleUrl: './entree-accueil.scss',
})
export class EntreeAccueil {
  readonly lien = input.required<string>();
  readonly icone = input.required<string>();
  readonly titre = input.required<string>();
  readonly texte = input.required<string>();
}
