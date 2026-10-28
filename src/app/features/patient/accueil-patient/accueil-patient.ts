import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-accueil-patient',
  imports: [MatCardModule, RouterLink],
  templateUrl: './accueil-patient.html',
  styleUrls: ['../patient.scss', './accueil-patient.scss'],
})
export class AccueilPatient {
  protected readonly auth = inject(AuthService);
}
