import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-barre-navigation',
  imports: [MatToolbarModule, MatButtonModule, RouterLink],
  templateUrl: './barre-navigation.html',
  styleUrl: './barre-navigation.scss',
})
export class BarreNavigation {
  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;
}
