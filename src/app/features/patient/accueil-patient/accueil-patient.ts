import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';

@Component({
  selector: 'app-accueil-patient',
  imports: [MatIconModule, RouterLink, EntetePage],
  templateUrl: './accueil-patient.html',
  styleUrl: './accueil-patient.scss',
})
export class AccueilPatient {
  protected readonly auth = inject(AuthService);
}
