import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import {
  DemandeConsultationService,
  TAILLE_PAGE_DEFAUT,
} from '../../../core/services/demande-consultation.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { PaginateurFrancais } from '../../../core/utils/paginateur-francais';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { StatutDemande } from '../../../shared/components/statut-demande/statut-demande';

@Component({
  selector: 'app-mes-demandes',
  imports: [
    DatePipe,
    RouterLink,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    StatutDemande,
    Encadre,
    EntetePage,
    EtatVide,
  ],
  // Fourni ici et non dans app.config : le paginateur reste hors du bundle initial.
  providers: [{ provide: MatPaginatorIntl, useClass: PaginateurFrancais }],
  templateUrl: './mes-demandes.html',
  styleUrl: './mes-demandes.scss',
})
export class MesDemandes implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly router = inject(Router);

  protected readonly colonnes = ['dateCreation', 'nomPatient', 'pourProche', 'statut'];
  protected readonly taillesPage = [10, 20, 50, 100];

  /** Page et taille restent en memoire : seul l'identifiant d'une demande va dans l'URL. */
  protected readonly page = signal(0);
  protected readonly taille = signal(TAILLE_PAGE_DEFAUT);
  protected readonly elements = signal<DemandeConsultationResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  /** Message laisse par le formulaire de nouvelle demande. */
  protected readonly information = signal(this.demandes.consommerMessageListe());

  private abonnement: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnement?.unsubscribe());
  }

  ngOnInit(): void {
    this.charger();
  }

  protected changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
    this.taille.set(evenement.pageSize);
    this.charger();
  }

  protected ouvrir(demande: DemandeConsultationResponse): void {
    void this.router.navigate(['/patient/demandes', demande.id]);
  }

  protected charger(): void {
    // Une page demandee annule la precedente : seule la derniere reponse s'affiche.
    this.abonnement?.unsubscribe();
    this.enCours.set(true);
    this.erreur.set(null);

    this.abonnement = this.demandes.mesDemandes(this.page(), this.taille()).subscribe({
      next: (reponse) => {
        this.enCours.set(false);
        this.elements.set(reponse.elements);
        this.total.set(reponse.totalElements);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.elements.set([]);
        this.erreur.set(messageErreur(erreur, 'Vos demandes n’ont pas pu être chargées.'));
      },
    });
  }
}
