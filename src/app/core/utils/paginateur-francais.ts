import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Libelles du paginateur Material en francais. */
@Injectable()
export class PaginateurFrancais extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Éléments par page';
  override nextPageLabel = 'Page suivante';
  override previousPageLabel = 'Page précédente';
  override firstPageLabel = 'Première page';
  override lastPageLabel = 'Dernière page';

  override getRangeLabel = (page: number, taille: number, total: number): string => {
    if (total === 0 || taille === 0) {
      return `0 sur ${total}`;
    }
    const debut = page * taille;
    const fin = Math.min(debut + taille, total);
    return `${debut + 1} – ${fin} sur ${total}`;
  };
}
