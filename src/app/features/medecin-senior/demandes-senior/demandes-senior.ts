import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListbox, MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  DemandeConsultationResponse,
  StatutDemandeConsultation,
} from '../../../core/models/demande-consultation.model';
import {
  DemandeConsultationService,
  TAILLE_PAGE_DEFAUT,
} from '../../../core/services/demande-consultation.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { TableauDemandes } from '../../../shared/components/tableau-demandes/tableau-demandes';

export type FiltreStatut = StatutDemandeConsultation | 'TOUTES';

interface OptionFiltre {
  valeur: FiltreStatut;
  libelle: string;
  icone: string;
  /** Etat vide propre au filtre. */
  vide: string;
}

export const OPTIONS_FILTRE: readonly OptionFiltre[] = [
  { valeur: 'TOUTES', libelle: 'Toutes', icone: 'list', vide: 'Aucune demande pour le moment.' },
  {
    valeur: 'EN_ATTENTE',
    libelle: 'En attente',
    icone: 'schedule',
    vide: 'Aucune demande en attente.',
  },
  {
    valeur: 'ACCEPTEE',
    libelle: 'Acceptées',
    icone: 'check_circle',
    vide: 'Aucune demande acceptée.',
  },
  { valeur: 'REFUSEE', libelle: 'Refusées', icone: 'cancel', vide: 'Aucune demande refusée.' },
];

/** Toutes les demandes, pour le medecin senior : filtre par statut, pagination serveur. */
@Component({
  selector: 'app-demandes-senior',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    Encadre,
    EntetePage,
    EtatVide,
    TableauDemandes,
  ],
  templateUrl: './demandes-senior.html',
  styleUrl: './demandes-senior.scss',
})
export class DemandesSenior implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly router = inject(Router);

  protected readonly options = OPTIONS_FILTRE;

  /** Filtre, page et taille restent en memoire : seul l'identifiant d'une demande va dans l'URL. */
  protected readonly filtre = signal<FiltreStatut>('EN_ATTENTE');
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

  protected texteVide(): string {
    return this.options.find((o) => o.valeur === this.filtre())!.vide;
  }

  protected changerFiltre(evenement: MatChipListboxChange, liste: MatChipListbox): void {
    const valeur = evenement.value as FiltreStatut | undefined;
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

  protected ouvrir(demande: DemandeConsultationResponse): void {
    void this.router.navigate(['/senior/demandes', demande.id]);
  }

  protected charger(): void {
    // Un filtre ou une page demandes annulent la requete precedente.
    this.abonnement?.unsubscribe();
    this.enCours.set(true);
    this.erreur.set(null);

    const filtre = this.filtre();
    const statut = filtre === 'TOUTES' ? null : filtre;
    this.abonnement = this.demandes.toutes(statut, this.page(), this.taille()).subscribe({
      next: (reponse) => {
        this.enCours.set(false);
        this.elements.set(reponse.elements);
        this.total.set(reponse.totalElements);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.elements.set([]);
        this.erreur.set(messageErreur(erreur, 'Les demandes n’ont pas pu être chargées.'));
      },
    });
  }
}
