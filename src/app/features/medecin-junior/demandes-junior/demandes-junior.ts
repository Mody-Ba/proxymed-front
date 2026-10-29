import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import {
  DemandeConsultationService,
  TAILLE_PAGE_DEFAUT,
} from '../../../core/services/demande-consultation.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { TableauDemandes } from '../../../shared/components/tableau-demandes/tableau-demandes';

export const MESSAGE_AUCUNE_ASSIGNEE = 'Aucune demande ne vous a été assignée pour le moment';

/** Demandes ACCEPTEES assignees au medecin junior connecte (le serveur filtre par le badge). */
@Component({
  selector: 'app-demandes-junior',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    Encadre,
    EntetePage,
    EtatVide,
    TableauDemandes,
  ],
  templateUrl: './demandes-junior.html',
  styleUrl: './demandes-junior.scss',
})
export class DemandesJunior implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly router = inject(Router);

  protected readonly messageVide = MESSAGE_AUCUNE_ASSIGNEE;

  /** Page et taille restent en memoire : seul l'identifiant d'une demande va dans l'URL. */
  protected readonly page = signal(0);
  protected readonly taille = signal(TAILLE_PAGE_DEFAUT);
  protected readonly elements = signal<DemandeConsultationResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

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
    void this.router.navigate(['/junior/demandes', demande.id]);
  }

  protected charger(): void {
    this.abonnement?.unsubscribe();
    this.enCours.set(true);
    this.erreur.set(null);

    this.abonnement = this.demandes.assigneesAMoi(this.page(), this.taille()).subscribe({
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
