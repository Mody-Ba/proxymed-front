import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListbox, MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { UtilisateurResponse } from '../../../core/models/auth.model';
import { LIBELLES_ROLE, Role } from '../../../core/models/role.model';
import {
  AdminUtilisateurService,
  TAILLE_PAGE_COMPTES,
} from '../../../core/services/admin-utilisateur.service';
import { AuthService } from '../../../core/services/auth.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { PaginateurFrancais } from '../../../core/utils/paginateur-francais';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatCompte } from '../../../shared/components/etat-compte/etat-compte';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import {
  ActionCompte,
  DialogueActionCompte,
  DonneesActionCompte,
  IssueActionCompte,
} from '../dialogue-action-compte/dialogue-action-compte';

export type FiltreRole = Role | 'TOUS';

interface OptionFiltre {
  valeur: FiltreRole;
  libelle: string;
  icone: string;
  vide: string;
}

export const OPTIONS_FILTRE_ROLE: readonly OptionFiltre[] = [
  { valeur: 'TOUS', libelle: 'Tous', icone: 'groups', vide: 'Aucun compte pour le moment.' },
  {
    valeur: 'MEDECIN_JUNIOR',
    libelle: 'Médecins juniors',
    icone: 'medical_services',
    vide: 'Aucun compte de médecin junior.',
  },
  {
    valeur: 'MEDECIN_SENIOR',
    libelle: 'Médecins seniors',
    icone: 'medical_services',
    vide: 'Aucun compte de médecin senior.',
  },
  { valeur: 'UTILISATEUR', libelle: 'Patients', icone: 'person', vide: 'Aucun compte patient.' },
  {
    valeur: 'ADMIN',
    libelle: 'Administrateurs',
    icone: 'admin_panel_settings',
    vide: 'Aucun compte administrateur.',
  },
];

export const EXPLICATION_PROPRE_COMPTE =
  'C’est votre compte : vous ne pouvez pas le désactiver vous-même.';

/**
 * Comptes PROXYMED pour l'administrateur : filtre par role, pagination serveur, activation et
 * reinitialisation du mot de passe. Aucune donnee medicale n'est lue ici.
 */
@Component({
  selector: 'app-comptes',
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    Encadre,
    EntetePage,
    EtatCompte,
    EtatVide,
  ],
  // Fourni ici et non dans app.config : le paginateur reste hors du bundle initial.
  providers: [{ provide: MatPaginatorIntl, useClass: PaginateurFrancais }],
  templateUrl: './comptes.html',
  styleUrl: './comptes.scss',
})
export class Comptes implements OnInit {
  private readonly comptes = inject(AdminUtilisateurService);
  private readonly auth = inject(AuthService);
  private readonly dialogues = inject(MatDialog);
  private readonly injector = inject(Injector);

  protected readonly options = OPTIONS_FILTRE_ROLE;
  protected readonly explicationPropreCompte = EXPLICATION_PROPRE_COMPTE;
  protected readonly colonnes = [
    'nomComplet',
    'email',
    'role',
    'actif',
    'motDePasseTemporaire',
    'actions',
  ];
  protected readonly taillesPage = [10, 20, 50, 100];

  /** Filtre, page et taille restent en memoire : seul l'identifiant d'un compte peut aller dans l'URL. */
  protected readonly filtre = signal<FiltreRole>('TOUS');
  protected readonly page = signal(0);
  protected readonly taille = signal(TAILLE_PAGE_COMPTES);
  protected readonly elements = signal<UtilisateurResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  /** Message laisse par la creation d'un compte, ou confirmation d'une action. */
  protected readonly information = signal(this.comptes.consommerMessageListe());

  /** Identifiant du compte connecte (GET /api/auth/moi) : affichage seulement. */
  private readonly monId = computed(() => this.auth.compte()?.id ?? null);
  private readonly zoneInformation = viewChild('zoneInformation', { read: ElementRef });
  private abonnement: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnement?.unsubscribe());
  }

  ngOnInit(): void {
    this.charger();
  }

  protected texteVide(): string {
    return this.options.find((o) => o.valeur === this.filtre())!.vide;
  }

  /**
   * Le serveur refuse de toute facon (400) qu'un admin se desactive : le bouton est seulement
   * rendu inactif pour l'expliquer avant le clic.
   */
  protected estMonCompte(compte: UtilisateurResponse): boolean {
    return compte.id === this.monId();
  }

  protected libelleRole(compte: UtilisateurResponse): string {
    return LIBELLES_ROLE[compte.role];
  }

  protected libelleActivation(compte: UtilisateurResponse): string {
    if (compte.actif && this.estMonCompte(compte)) {
      return `Désactiver le compte de ${compte.nomComplet} : impossible, c’est votre compte`;
    }
    return `${compte.actif ? 'Désactiver' : 'Activer'} le compte de ${compte.nomComplet}`;
  }

  protected changerFiltre(evenement: MatChipListboxChange, liste: MatChipListbox): void {
    const valeur = evenement.value as FiltreRole | undefined;
    if (!valeur) {
      // Un clic sur le filtre deja actif le deselectionnerait : il reste choisi.
      liste.value = this.filtre();
      return;
    }
    this.filtre.set(valeur);
    this.page.set(0);
    this.charger();
  }

  protected changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
    this.taille.set(evenement.pageSize);
    this.charger();
  }

  protected ouvrirAction(compte: UtilisateurResponse, action: ActionCompte): void {
    if (action === 'activation' && compte.actif && this.estMonCompte(compte)) {
      return;
    }
    this.information.set(null);
    this.dialogues
      .open<DialogueActionCompte, DonneesActionCompte, IssueActionCompte>(DialogueActionCompte, {
        data: { compte, action },
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((resultat) => {
        if (!resultat) {
          return;
        }
        this.information.set(resultat.message);
        this.charger();
        afterNextRender(
          () => (this.zoneInformation()?.nativeElement as HTMLElement | undefined)?.focus(),
          { injector: this.injector },
        );
      });
  }

  protected charger(): void {
    // Un filtre ou une page demandes annulent la requete precedente.
    this.abonnement?.unsubscribe();
    this.enCours.set(true);
    this.erreur.set(null);

    const filtre = this.filtre();
    const role = filtre === 'TOUS' ? null : filtre;
    this.abonnement = this.comptes.lister(role, this.page(), this.taille()).subscribe({
      next: (reponse) => {
        this.enCours.set(false);
        this.elements.set(reponse.contenu);
        this.total.set(reponse.totalElements);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.elements.set([]);
        this.erreur.set(messageErreur(erreur, 'Les comptes n’ont pas pu être chargés.'));
      },
    });
  }
}
