import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';
import { CarteInfo } from '../carte-info/carte-info';
import { EntetePage } from '../entete-page/entete-page';

/** Page d'accueil provisoire commune aux 4 roles ; le titre vient des donnees de la route. */
@Component({
  selector: 'app-accueil-provisoire',
  imports: [MatButtonModule, MatIconModule, EntetePage, CarteInfo],
  templateUrl: './accueil-provisoire.html',
  styleUrl: './accueil-provisoire.scss',
})
export class AccueilProvisoire {
  readonly titre = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;
}
