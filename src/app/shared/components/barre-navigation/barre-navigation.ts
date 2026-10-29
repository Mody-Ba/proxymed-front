import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';
import { LIENS_PAR_ROLE } from '../menu-navigation/liens-navigation';
import { MenuNavigation } from '../menu-navigation/menu-navigation';

/** En dessous de cette largeur, les liens passent dans le menu lateral (mat-sidenav). */
const REQUETE_TELEPHONE = '(max-width: 767.98px)';

@Component({
  selector: 'app-barre-navigation',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MenuNavigation,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './barre-navigation.html',
  styleUrl: './barre-navigation.scss',
})
export class BarreNavigation {
  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;

  /** Menu lateral (mat-sidenav), utilise seulement sur telephone. */
  protected readonly menuOuvert = signal(false);

  protected readonly estTelephone = toSignal(
    inject(BreakpointObserver)
      .observe(REQUETE_TELEPHONE)
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  constructor() {
    // Repasse en grand ecran : les liens reviennent dans la barre, le menu lateral se ferme.
    effect(() => {
      if (!this.estTelephone()) {
        this.menuOuvert.set(false);
      }
    });
  }

  /** Affichage seulement : le serveur refuse ces appels a tout autre role. */
  protected readonly liens = computed(() => {
    const role = this.auth.role();
    return role && !this.auth.motDePasseTemporaire() ? LIENS_PAR_ROLE[role] : [];
  });
}
