import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import {
  LIBELLES_TYPE_VISITE,
  MAX_FICHES_IMPRESSION,
  PatientIdentite,
  TypeVisite,
} from '../../../core/models/fiches-admin.model';
import { FichesAdminService } from '../../../core/services/fiches-admin.service';
import { messageErreur, messageImpressionFiches } from '../../../core/utils/erreur-http';
import {
  ajouterASelection,
  basculerSelection,
  MESSAGE_SELECTION_MAX,
} from '../../../core/utils/fiches-admin';
import { enregistrerFichier } from '../../../core/utils/fichier';
import { PaginateurFrancais } from '../../../core/utils/paginateur-francais';
import { Encadre, TypeEncadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';

interface Message {
  type: TypeEncadre;
  texte: string;
}

export function messageImpressionReussie(nombre: number): string {
  return nombre > 1
    ? `${nombre} fiches ont été créées et réunies dans un seul PDF, téléchargé sur votre appareil.`
    : 'La fiche a été créée et téléchargée sur votre appareil.';
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Impression de fiches vierges par l'admin : recherche de patients (identite seule), selection
 * de 50 patients au plus, type de visite, puis un seul PDF combine. Aucune donnee medicale.
 */
@Component({
  selector: 'app-impression-fiches',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    Encadre,
    EntetePage,
    EtatVide,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginateurFrancais }],
  templateUrl: './impression-fiches.html',
  styleUrl: './impression-fiches.scss',
})
export class ImpressionFiches implements OnInit {
  private readonly service = inject(FichesAdminService);

  protected readonly max = MAX_FICHES_IMPRESSION;
  protected readonly colonnes = ['selection', 'nomComplet', 'numeroDossier', 'dateNaissance'];
  protected readonly taillesPage = [10, 20, 50];
  protected readonly typesVisite = (Object.keys(LIBELLES_TYPE_VISITE) as TypeVisite[]).map(
    (valeur) => ({ valeur, libelle: LIBELLES_TYPE_VISITE[valeur] }),
  );

  protected readonly patients = signal<PatientIdentite[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreurChargement = signal<string | null>(null);
  protected readonly recherche = signal('');
  protected readonly page = signal(0);
  protected readonly taille = signal(20);
  protected readonly selection = signal<ReadonlySet<string>>(new Set());
  protected readonly typeVisite = signal<TypeVisite | null>(null);
  protected readonly impression = signal(false);
  protected readonly message = signal<Message | null>(null);
  protected readonly avertissement = signal<string | null>(null);

  protected readonly filtres = computed(() => {
    const terme = normaliser(this.recherche());
    const tous = this.patients();
    if (!terme) {
      return tous;
    }
    return tous.filter(
      (p) =>
        normaliser(p.nomComplet).includes(terme) ||
        normaliser(p.numeroDossierProxymed ?? '').includes(terme),
    );
  });

  protected readonly pageCourante = computed(() => {
    const debut = this.page() * this.taille();
    return this.filtres().slice(debut, debut + this.taille());
  });

  protected readonly nombreSelectionnes = computed(() => this.selection().size);
  protected readonly limiteAtteinte = computed(() => this.nombreSelectionnes() >= this.max);
  protected readonly pageEntierementCochee = computed(() => {
    const page = this.pageCourante();
    return page.length > 0 && page.every((p) => this.selection().has(p.id));
  });
  protected readonly pagePartiellementCochee = computed(
    () =>
      !this.pageEntierementCochee() && this.pageCourante().some((p) => this.selection().has(p.id)),
  );
  protected readonly peutImprimer = computed(
    () => this.nombreSelectionnes() > 0 && this.typeVisite() !== null && !this.impression(),
  );

  private chargementEnCours: Subscription | null = null;
  private impressionEnCours: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.chargementEnCours?.unsubscribe();
      this.impressionEnCours?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  protected charger(): void {
    this.chargementEnCours?.unsubscribe();
    this.chargement.set(true);
    this.erreurChargement.set(null);
    this.chargementEnCours = this.service.listerPatients().subscribe({
      next: (patients) => {
        this.chargement.set(false);
        this.patients.set(
          [...patients].sort((a, b) => a.nomComplet.localeCompare(b.nomComplet, 'fr')),
        );
      },
      error: (erreur: unknown) => {
        this.chargement.set(false);
        this.patients.set([]);
        this.erreurChargement.set(
          messageErreur(erreur, 'La liste des patients n’a pas pu être chargée.'),
        );
      },
    });
  }

  protected rechercher(valeur: string): void {
    this.recherche.set(valeur);
    this.page.set(0);
  }

  protected changerPage(evenement: PageEvent): void {
    this.page.set(evenement.pageIndex);
    this.taille.set(evenement.pageSize);
  }

  protected estCoche(patient: PatientIdentite): boolean {
    return this.selection().has(patient.id);
  }

  protected basculer(patient: PatientIdentite): void {
    const resultat = basculerSelection(this.selection(), patient.id, this.max);
    this.selection.set(resultat.selection);
    this.avertissement.set(resultat.ignores ? MESSAGE_SELECTION_MAX : null);
  }

  protected basculerPage(): void {
    const ids = this.pageCourante().map((p) => p.id);
    if (this.pageEntierementCochee()) {
      const suivante = new Set(this.selection());
      ids.forEach((id) => suivante.delete(id));
      this.selection.set(suivante);
      this.avertissement.set(null);
      return;
    }
    const resultat = ajouterASelection(this.selection(), ids, this.max);
    this.selection.set(resultat.selection);
    this.avertissement.set(resultat.ignores ? MESSAGE_SELECTION_MAX : null);
  }

  protected viderSelection(): void {
    this.selection.set(new Set());
    this.avertissement.set(null);
  }

  protected imprimer(): void {
    const type = this.typeVisite();
    // Pas de double envoi : un clic pendant l'appel est ignore.
    if (!type || !this.selection().size || this.impression()) {
      return;
    }
    // Ordre des fiches dans le PDF : celui de la liste affichee.
    const ids = this.patients()
      .map((p) => p.id)
      .filter((id) => this.selection().has(id));
    this.message.set(null);
    this.impression.set(true);
    this.impressionEnCours = this.service.imprimer(ids, type).subscribe({
      next: (fichier) => {
        this.impression.set(false);
        enregistrerFichier(fichier.contenu, fichier.nomFichier);
        this.message.set({ type: 'succes', texte: messageImpressionReussie(ids.length) });
        this.viderSelection();
      },
      error: (erreur: unknown) => {
        this.impression.set(false);
        this.message.set({ type: 'erreur', texte: messageImpressionFiches(erreur) });
      },
    });
  }
}
