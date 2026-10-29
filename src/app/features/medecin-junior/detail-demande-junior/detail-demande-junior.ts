import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { messageChargementDemande } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { FicheDemande } from '../../../shared/components/fiche-demande/fiche-demande';

/**
 * Detail en lecture seule d'une demande assignee au junior : aucune action. Le serveur repond
 * 403 si la demande n'est pas assignee a ce junior.
 */
@Component({
  selector: 'app-detail-demande-junior',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    Encadre,
    EntetePage,
    EtatVide,
    FicheDemande,
  ],
  templateUrl: './detail-demande-junior.html',
  styleUrl: './detail-demande-junior.scss',
})
export class DetailDemandeJunior implements OnInit {
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
