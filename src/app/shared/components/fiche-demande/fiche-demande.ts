import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { CarteInfo } from '../carte-info/carte-info';
import { Encadre } from '../encadre/encadre';
import { StatutDemande } from '../statut-demande/statut-demande';

/**
 * Detail d'une demande pour l'equipe medicale : statut, patient, proche, dates, motif et,
 * si elle est refusee, motif du refus. Lecture seule : les actions restent dans la page.
 */
@Component({
  selector: 'app-fiche-demande',
  imports: [DatePipe, CarteInfo, Encadre, StatutDemande],
  templateUrl: './fiche-demande.html',
  styleUrl: './fiche-demande.scss',
})
export class FicheDemande {
  readonly demande = input.required<DemandeConsultationResponse>();
}
