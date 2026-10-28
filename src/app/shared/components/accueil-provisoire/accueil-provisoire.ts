import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';

/** Page d'accueil provisoire commune aux 4 roles ; le titre vient des donnees de la route. */
@Component({
  selector: 'app-accueil-provisoire',
  imports: [MatCardModule, MatButtonModule],
  templateUrl: './accueil-provisoire.html',
  styleUrl: './accueil-provisoire.scss',
})
export class AccueilProvisoire {
  readonly titre = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;
}
