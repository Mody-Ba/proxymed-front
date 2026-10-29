import { Component, computed, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';
import { LIENS_PAR_ROLE } from './liens-navigation';

/** Menu lateral (mat-sidenav) affiche sur telephone a la place des liens de la barre. */
@Component({
  selector: 'app-menu-navigation',
  imports: [MatIconModule, RouterLink, RouterLinkActive],
  templateUrl: './menu-navigation.html',
  styleUrl: './menu-navigation.scss',
})
export class MenuNavigation {
  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;

  /** Emis quand un lien est choisi, pour refermer le menu. */
  readonly choisi = output<void>();

  protected readonly liens = computed(() => {
    const role = this.auth.role();
    return role && !this.auth.motDePasseTemporaire() ? LIENS_PAR_ROLE[role] : [];
  });
}
