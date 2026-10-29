import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  LIBELLES_STATUT_DEMANDE,
  StatutDemandeConsultation,
} from '../../../core/models/demande-consultation.model';

const ICONES_STATUT: Record<StatutDemandeConsultation, string> = {
  EN_ATTENTE: 'schedule',
  ACCEPTEE: 'check_circle',
  REFUSEE: 'cancel',
};

/**
 * Pastille de statut d'une demande : icone ET libelle en toutes lettres, la couleur ne fait
 * qu'appuyer. Styles dans styles.scss (.pastille-statut), reutilises par les autres ecrans.
 */
@Component({
  selector: 'app-statut-demande',
  imports: [MatIconModule],
  template: `<span [class]="'pastille-statut statut statut-' + classe()"
    ><mat-icon [fontIcon]="icone()" aria-hidden="true" />{{ libelle() }}</span
  >`,
})
export class StatutDemande {
  readonly statut = input.required<StatutDemandeConsultation>();

  protected readonly libelle = computed(() => LIBELLES_STATUT_DEMANDE[this.statut()]);
  protected readonly icone = computed(() => ICONES_STATUT[this.statut()]);
  protected readonly classe = computed(() => this.statut().toLowerCase().replace('_', '-'));
}
