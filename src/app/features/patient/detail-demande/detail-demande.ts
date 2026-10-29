import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import {
  MESSAGE_DEMANDE_ACCES_REFUSE,
  MESSAGE_DEMANDE_INTROUVABLE,
  messageChargementDemande,
} from '../../../core/utils/erreur-http';
import { CarteInfo } from '../../../shared/components/carte-info/carte-info';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { StatutDemande } from '../../../shared/components/statut-demande/statut-demande';

export const MESSAGE_ACCES_REFUSE = MESSAGE_DEMANDE_ACCES_REFUSE;
export const MESSAGE_INTROUVABLE = MESSAGE_DEMANDE_INTROUVABLE;

@Component({
  selector: 'app-detail-demande',
  imports: [
    DatePipe,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    StatutDemande,
    CarteInfo,
    Encadre,
    EntetePage,
    EtatVide,
  ],
  templateUrl: './detail-demande.html',
  styleUrl: './detail-demande.scss',
})
export class DetailDemande implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Parametre :id de la route (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly demande = signal<DemandeConsultationResponse | null>(null);
  protected readonly enCours = signal(true);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    const abonnement = this.demandes.findById(this.id()).subscribe({
      next: (demande) => {
        this.enCours.set(false);
        this.demande.set(demande);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.erreur.set(messageChargementDemande(erreur));
      },
    });
    this.destroyRef.onDestroy(() => abonnement.unsubscribe());
  }
}
