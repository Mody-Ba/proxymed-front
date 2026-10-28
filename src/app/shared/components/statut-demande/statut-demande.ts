import { Component, computed, input } from '@angular/core';
import {
  LIBELLES_STATUT_DEMANDE,
  StatutDemandeConsultation,
} from '../../../core/models/demande-consultation.model';

/** Statut d'une demande : toujours un libelle en toutes lettres, la couleur ne fait qu'appuyer. */
@Component({
  selector: 'app-statut-demande',
  template: `<span [class]="'statut statut-' + classe()">{{ libelle() }}</span>`,
  styleUrl: './statut-demande.scss',
})
export class StatutDemande {
  readonly statut = input.required<StatutDemandeConsultation>();

  protected readonly libelle = computed(() => LIBELLES_STATUT_DEMANDE[this.statut()]);
  protected readonly classe = computed(() => this.statut().toLowerCase().replace('_', '-'));
}
