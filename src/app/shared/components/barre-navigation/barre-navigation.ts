import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-barre-navigation',
  imports: [MatToolbarModule, MatButtonModule, RouterLink, RouterLinkActive],
  templateUrl: './barre-navigation.html',
  styleUrl: './barre-navigation.scss',
})
export class BarreNavigation {
  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;
  /** Affichage seulement : le serveur refuse ces appels a tout autre role. */
  protected readonly estPatient = computed(
    () => this.auth.role() === 'UTILISATEUR' && !this.auth.motDePasseTemporaire(),
  );
}
