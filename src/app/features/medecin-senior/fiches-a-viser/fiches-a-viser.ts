import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { FichierTelecharge } from '../../../core/models/fiche-signee.model';
import { LIBELLES_TYPE_VISITE, TypeVisite } from '../../../core/models/fiches-admin.model';
import {
  DecisionLotResponse,
  FicheAViserResponse,
  MAX_FICHES_DECISION,
  TAILLE_PAGE_FICHES,
} from '../../../core/models/visa-fiche.model';
import { VisaFicheService } from '../../../core/services/visa-fiche.service';
import { messageDecisionFiches, messageTelechargementVisa } from '../../../core/utils/erreur-http';
import { enregistrerFichier } from '../../../core/utils/fichier';
import { PaginateurFrancais } from '../../../core/utils/paginateur-francais';
import {
  ActionDecision,
  ajouterASelection,
  basculerSelection,
  erreurSelectionDecision,
  identitePatient,
  LigneDecision,
  lignesDecision,
  MESSAGE_SELECTION_FICHES_MAX,
  resumeDecision,
} from '../../../core/utils/visa-fiches';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { DialogueRenvoiFiches } from '../dialogue-renvoi-fiches/dialogue-renvoi-fiches';
import {
  DialogueVisaFiches,
  DonneesDecisionFiches,
} from '../dialogue-visa-fiches/dialogue-visa-fiches';

interface ResultatAction {
  action: ActionDecision;
  resume: string;
  avecErreurs: boolean;
  lignes: LigneDecision[];
}

export function libelleTypeVisite(type: TypeVisite | undefined): string {
  return type ? LIBELLES_TYPE_VISITE[type] : '—';
}

/**
 * Fiches EN_ATTENTE du senior : consultation du scan, visa ou renvoi en lot (50 fiches au plus),
 * tableau de resultats par fiche (une fiche deja traitee n'empeche pas les autres), puis
 * rafraichissement de la liste.
 */
@Component({
  selector: 'app-fiches-a-viser',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    Encadre,
    EntetePage,
    EtatVide,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginateurFrancais }],
  templateUrl: './fiches-a-viser.html',
  styleUrl: './fiches-a-viser.scss',
})
export class FichesAViser implements OnInit {
  private readonly service = inject(VisaFicheService);
  private readonly dialogues = inject(MatDialog);

  protected readonly max = MAX_FICHES_DECISION;
  protected readonly colonnes = ['selection', 'patient', 'typeVisite', 'dateImport', 'scan'];
  protected readonly colonnesResultat = ['patient', 'statut', 'message', 'rapport'];
  protected readonly taillesPage = [10, 20, 50, 100];
  protected readonly identitePatient = identitePatient;
  protected readonly libelleTypeVisite = libelleTypeVisite;

  protected readonly fiches = signal<FicheAViserResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly taille = signal(TAILLE_PAGE_FICHES);
  protected readonly chargement = signal(false);
  protected readonly erreurChargement = signal<string | null>(null);

  /** Selection conservee d'une page a l'autre : visiteId -> fiche (pour l'identite des resultats). */
  protected readonly selection = signal<ReadonlyMap<string, FicheAViserResponse>>(new Map());
  protected readonly avertissement = signal<string | null>(null);
  protected readonly action = signal<ActionDecision | null>(null);
  protected readonly erreurAction = signal<string | null>(null);
  protected readonly resultat = signal<ResultatAction | null>(null);

  /** Telechargement en cours : "scan:<visiteId>" ou "rapport:<visiteId>". */
  protected readonly telechargement = signal<string | null>(null);
  protected readonly erreurTelechargement = signal<string | null>(null);

  protected readonly nombreSelectionnees = computed(() => this.selection().size);
  protected readonly limiteAtteinte = computed(() => this.nombreSelectionnees() >= this.max);
  protected readonly occupe = computed(() => this.action() !== null);
  protected readonly pageEntierementCochee = computed(() => {
    const page = this.fiches();
    return page.length > 0 && page.every((f) => this.selection().has(f.visiteId));
  });
  protected readonly pagePartiellementCochee = computed(
    () =>
      !this.pageEntierementCochee() && this.fiches().some((f) => this.selection().has(f.visiteId)),
  );

  private readonly abonnements = new Subscription();
  private abonnementListe: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abonnements.unsubscribe();
      this.abonnementListe?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  protected charger(): void {
    this.abonnementListe?.unsubscribe();
    this.chargement.set(true);
    this.erreurChargement.set(null);
    this.abonnementListe = this.service.lister('EN_ATTENTE', this.page(), this.taille()).subscribe({
      next: (reponse) => {
        this.chargement.set(false);
        // Page videe par une action (derniere page) : on revient a la precedente.
        if (!reponse.elements.length && reponse.totalElements > 0 && this.page() > 0) {
          this.page.set(Math.max(0, reponse.totalPages - 1));
          this.charger();
          return;
        }
        this.fiches.set(reponse.elements);
        this.total.set(reponse.totalElements);
      },
      error: (erreur: unknown) => {
        this.chargement.set(false);
        this.fiches.set([]);
        this.erreurChargement.set(
          messageDecisionFiches(erreur, 'Les fiches à viser n’ont pas pu être chargées.'),
        );
      },
    });
  }

  protected changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
    this.taille.set(evenement.pageSize);
    this.charger();
  }

  protected estCochee(fiche: FicheAViserResponse): boolean {
    return this.selection().has(fiche.visiteId);
  }

  protected basculer(fiche: FicheAViserResponse): void {
    const resultat = basculerSelection(new Set(this.selection().keys()), fiche.visiteId, this.max);
    this.appliquerSelection(resultat.selection, resultat.ignores, [fiche]);
  }

  protected basculerPage(): void {
    const page = this.fiches();
    if (this.pageEntierementCochee()) {
      const suivante = new Map(this.selection());
      page.forEach((f) => suivante.delete(f.visiteId));
      this.selection.set(suivante);
      this.avertissement.set(null);
      return;
    }
    const resultat = ajouterASelection(
      new Set(this.selection().keys()),
      page.map((f) => f.visiteId),
      this.max,
    );
    this.appliquerSelection(resultat.selection, resultat.ignores, page);
  }

  protected viderSelection(): void {
    this.selection.set(new Map());
    this.avertissement.set(null);
  }

  protected viserSelection(): void {
    const ids = this.idsSelectionnes();
    if (!this.verifierSelection(ids)) {
      return;
    }
    this.dialogues
      .open<DialogueVisaFiches, DonneesDecisionFiches, boolean>(DialogueVisaFiches, {
        data: { nombre: ids.length },
        width: '480px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((confirme) => {
        if (confirme) {
          this.executer('visa', this.service.viser(ids));
        }
      });
  }

  protected renvoyerSelection(): void {
    const ids = this.idsSelectionnes();
    if (!this.verifierSelection(ids)) {
      return;
    }
    this.dialogues
      .open<DialogueRenvoiFiches, DonneesDecisionFiches, string>(DialogueRenvoiFiches, {
        data: { nombre: ids.length },
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((motif) => {
        if (motif) {
          this.executer('renvoi', this.service.renvoyer(ids, motif));
        }
      });
  }

  protected telechargerScan(visiteId: string): void {
    this.telecharger(`scan:${visiteId}`, this.service.telechargerScan(visiteId), 'scan');
  }

  protected telechargerRapport(visiteId: string): void {
    this.telecharger(`rapport:${visiteId}`, this.service.telechargerRapport(visiteId), 'rapport');
  }

  private telecharger(
    cle: string,
    requete: Observable<FichierTelecharge>,
    document: 'scan' | 'rapport',
  ): void {
    if (this.telechargement()) {
      return;
    }
    this.erreurTelechargement.set(null);
    this.telechargement.set(cle);
    this.abonnements.add(
      requete.subscribe({
        next: (fichier) => {
          this.telechargement.set(null);
          enregistrerFichier(fichier.contenu, fichier.nomFichier);
        },
        error: (erreur: unknown) => {
          this.telechargement.set(null);
          this.erreurTelechargement.set(messageTelechargementVisa(erreur, document));
        },
      }),
    );
  }

  private idsSelectionnes(): string[] {
    return [...this.selection().keys()];
  }

  private verifierSelection(ids: string[]): boolean {
    if (this.occupe()) {
      return false;
    }
    const erreur = erreurSelectionDecision(ids, this.max);
    this.avertissement.set(erreur);
    return !erreur;
  }

  private appliquerSelection(
    ids: ReadonlySet<string>,
    ignores: number,
    fiches: readonly FicheAViserResponse[],
  ): void {
    const connues = new Map(this.selection());
    fiches.forEach((f) => connues.set(f.visiteId, f));
    this.selection.set(new Map([...ids].map((id) => [id, connues.get(id)!])));
    this.avertissement.set(ignores ? MESSAGE_SELECTION_FICHES_MAX : null);
  }

  private executer(action: ActionDecision, requete: Observable<DecisionLotResponse>): void {
    if (this.occupe()) {
      return;
    }
    const fichesConnues = this.selection();
    this.action.set(action);
    this.erreurAction.set(null);
    this.resultat.set(null);
    this.abonnements.add(
      requete.subscribe({
        next: (reponse) => {
          this.action.set(null);
          this.resultat.set({
            action,
            resume: resumeDecision(action, reponse),
            avecErreurs: reponse.nombreErreurs > 0,
            lignes: lignesDecision(reponse.resultats, fichesConnues),
          });
          this.viderSelection();
          this.charger();
        },
        error: (erreur: unknown) => {
          this.action.set(null);
          this.erreurAction.set(
            messageDecisionFiches(
              erreur,
              action === 'visa'
                ? 'Les fiches n’ont pas pu être visées.'
                : 'Les fiches n’ont pas pu être renvoyées.',
            ),
          );
        },
      }),
    );
  }
}
