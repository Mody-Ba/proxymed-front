import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EntreeAccueil } from '../../../shared/components/entree-accueil/entree-accueil';

@Component({
  selector: 'app-accueil-junior',
  imports: [MatIconModule, EntetePage, EntreeAccueil],
  templateUrl: './accueil-junior.html',
  styleUrl: '../../accueil-medecin.scss',
})
export class AccueilJunior {
  protected readonly auth = inject(AuthService);
}
