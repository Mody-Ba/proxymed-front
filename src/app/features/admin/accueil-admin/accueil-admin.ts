import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EntreeAccueil } from '../../../shared/components/entree-accueil/entree-accueil';

@Component({
  selector: 'app-accueil-admin',
  imports: [MatIconModule, Encadre, EntetePage, EntreeAccueil],
  templateUrl: './accueil-admin.html',
  styleUrl: '../../accueil-medecin.scss',
})
export class AccueilAdmin {
  protected readonly auth = inject(AuthService);
}
