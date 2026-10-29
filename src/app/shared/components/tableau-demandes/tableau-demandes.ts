import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { PaginateurFrancais } from '../../../core/utils/paginateur-francais';
import { StatutDemande } from '../statut-demande/statut-demande';

/**
 * Tableau pagine cote serveur des demandes de consultation (patient, senior, junior) :
 * date, patient, pour un proche, statut. Une ligne s'ouvre au clic ou a la touche Entree ;
 * la page parente choisit la route du detail.
 */
@Component({
  selector: 'app-tableau-demandes',
  imports: [DatePipe, MatTableModule, MatPaginatorModule, StatutDemande],
  // Fourni ici et non dans app.config : le paginateur reste hors du bundle initial.
  providers: [{ provide: MatPaginatorIntl, useClass: PaginateurFrancais }],
  templateUrl: './tableau-demandes.html',
  styleUrl: './tableau-demandes.scss',
})
export class TableauDemandes {
  readonly elements = input.required<DemandeConsultationResponse[]>();
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly taille = input.required<number>();
  readonly enCours = input(false);
  /** Legende lue par les lecteurs d'ecran. */
  readonly legende = input.required<string>();
  readonly libellePagination = input('Pagination des demandes');

  readonly ouvrir = output<DemandeConsultationResponse>();
  readonly changerPage = output<PageEvent>();

  protected readonly colonnes = ['dateCreation', 'nomPatient', 'pourProche', 'statut'];
  protected readonly taillesPage = [10, 20, 50, 100];
}
