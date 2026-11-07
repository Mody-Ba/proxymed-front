import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { FicheAViserResponse, TAILLE_PAGE_FICHES } from '../../../core/models/visa-fiche.model';
import { VisaFicheService } from '../../../core/services/visa-fiche.service';
import { messageDecisionFiches, messageTelechargementVisa } from '../../../core/utils/erreur-http';
import { enregistrerFichier } from '../../../core/utils/fichier';
import { PaginateurFrancais } from '../../../core/utils/paginateur-francais';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { libelleTypeVisite } from '../fiches-a-viser/fiches-a-viser';

/** Fiches VISEE (GET /api/fiches-signees?statut=VISEE) avec le telechargement de leur rapport. */
@Component({
  selector: 'app-fiches-visees',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
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
  templateUrl: './fiches-visees.html',
  styleUrl: '../fiches-a-viser/fiches-a-viser.scss',
})
export class FichesVisees implements OnInit {
  private readonly service = inject(VisaFicheService);

  protected readonly colonnes = ['patient', 'typeVisite', 'visa', 'rapport'];
  protected readonly taillesPage = [10, 20, 50, 100];
  protected readonly libelleTypeVisite = libelleTypeVisite;

  protected readonly fiches = signal<FicheAViserResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly taille = signal(TAILLE_PAGE_FICHES);
  protected readonly chargement = signal(false);
  protected readonly erreurChargement = signal<string | null>(null);
  protected readonly telechargement = signal<string | null>(null);
  protected readonly erreurTelechargement = signal<string | null>(null);

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
    this.abonnementListe = this.service.lister('VISEE', this.page(), this.taille()).subscribe({
      next: (reponse) => {
        this.chargement.set(false);
        this.fiches.set(reponse.elements);
        this.total.set(reponse.totalElements);
      },
      error: (erreur: unknown) => {
        this.chargement.set(false);
        this.fiches.set([]);
        this.erreurChargement.set(
          messageDecisionFiches(erreur, 'Les fiches visées n’ont pas pu être chargées.'),
        );
      },
    });
  }

  protected changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
    this.taille.set(evenement.pageSize);
    this.charger();
  }

  protected telechargerRapport(visiteId: string): void {
    if (this.telechargement()) {
      return;
    }
    this.erreurTelechargement.set(null);
    this.telechargement.set(visiteId);
    this.abonnements.add(
      this.service.telechargerRapport(visiteId).subscribe({
        next: (fichier) => {
          this.telechargement.set(null);
          enregistrerFichier(fichier.contenu, fichier.nomFichier);
        },
        error: (erreur: unknown) => {
          this.telechargement.set(null);
          this.erreurTelechargement.set(messageTelechargementVisa(erreur, 'rapport'));
        },
      }),
    );
  }
}
