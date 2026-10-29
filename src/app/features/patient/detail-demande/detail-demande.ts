import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { CarteInfo } from '../../../shared/components/carte-info/carte-info';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { StatutDemande } from '../../../shared/components/statut-demande/statut-demande';

export const MESSAGE_ACCES_REFUSE = 'Vous n’avez pas accès à cette demande.';
export const MESSAGE_INTROUVABLE = 'Cette demande est introuvable.';

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
        this.erreur.set(this.messagePour(erreur));
      },
    });
    this.destroyRef.onDestroy(() => abonnement.unsubscribe());
  }

  /** 403 / 404 (et 400 pour un identifiant mal forme) : message clair, sans detail technique. */
  private messagePour(erreur: unknown): string {
    if (erreur instanceof HttpErrorResponse) {
      if (erreur.status === 403) {
        return MESSAGE_ACCES_REFUSE;
      }
      if (erreur.status === 404 || erreur.status === 400) {
        return MESSAGE_INTROUVABLE;
      }
    }
    return messageErreur(erreur, 'La demande n’a pas pu être chargée.');
  }
}
