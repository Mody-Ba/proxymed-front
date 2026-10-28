import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-acces-refuse',
  imports: [MatCardModule, MatButtonModule, RouterLink],
  templateUrl: './acces-refuse.html',
  styleUrl: './acces-refuse.scss',
})
export class AccesRefuse {
  protected readonly auth = inject(AuthService);
}
