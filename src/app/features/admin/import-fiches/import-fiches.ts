import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import {
  ImportLotResponse,
  MAX_FICHIERS_IMPORT,
  PatientIdentite,
  ResultatImportResponse,
} from '../../../core/models/fiches-admin.model';
import { FichesAdminService } from '../../../core/services/fiches-admin.service';
import { messageImportLot, messageResultatImport } from '../../../core/utils/erreur-http';
import {
  ajouterFichiers,
  erreurAvantEnvoi,
  LIBELLES_STATUT_IMPORT,
  StatutImport,
  statutImport,
} from '../../../core/utils/fiches-admin';
import { tailleLisible } from '../../../core/utils/fichier';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';

export interface LigneResultat {
  index: number;
  nomFichier: string;
  statut: StatutImport;
  libelleStatut: string;
  patient: string;
  message: string;
}

export function resumeImport(reponse: ImportLotResponse): string {
  const { nombreFichiers, nombreImportees, nombreErreurs } = reponse;
  const fichiers = `${nombreFichiers} fichier${nombreFichiers > 1 ? 's' : ''} traité${nombreFichiers > 1 ? 's' : ''}`;
  return `${fichiers} : ${nombreImportees} importé${nombreImportees > 1 ? 's' : ''}, ${nombreErreurs} non importé${nombreErreurs > 1 ? 's' : ''}.`;
}

/**
 * Import en lot des fiches remplies par l'admin : chaque PDF est range par le serveur d'apres son
 * code QR. Le resultat ne contient que des identifiants ; l'identite du patient est retrouvee dans
 * la liste des patients (identite seule). Aucune donnee medicale n'est lue.
 */
@Component({
  selector: 'app-import-fiches',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    Encadre,
    EntetePage,
  ],
  templateUrl: './import-fiches.html',
  styleUrl: './import-fiches.scss',
})
export class ImportFiches implements OnInit {
  private readonly service = inject(FichesAdminService);

  protected readonly max = MAX_FICHIERS_IMPORT;
  protected readonly tailleLisible = tailleLisible;
  protected readonly colonnes = ['nomFichier', 'statut', 'patient', 'message'];

  protected readonly fichiers = signal<File[]>([]);
  protected readonly refus = signal<string[]>([]);
  protected readonly survol = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly reponse = signal<ImportLotResponse | null>(null);
  private readonly identites = signal<ReadonlyMap<string, PatientIdentite>>(new Map());

  protected readonly lignes = computed<LigneResultat[]>(() =>
    (this.reponse()?.resultats ?? []).map((r) => this.ligne(r)),
  );
  protected readonly resume = computed(() => {
    const reponse = this.reponse();
    return reponse ? resumeImport(reponse) : null;
  });

  private readonly abonnements = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnements.unsubscribe());
  }

  ngOnInit(): void {
    this.chargerIdentites();
  }

  protected fichiersChoisis(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const choisis = Array.from(champ.files ?? []);
    // Remis a zero : le meme fichier peut etre choisi de nouveau apres retrait.
    champ.value = '';
    this.ajouter(choisis);
  }

  protected survoler(evenement: DragEvent): void {
    evenement.preventDefault();
    if (!this.envoi()) {
      this.survol.set(true);
    }
  }

  protected quitter(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
  }

  protected deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    if (this.envoi()) {
      return;
    }
    this.ajouter(Array.from(evenement.dataTransfer?.files ?? []));
  }

  protected retirer(index: number): void {
    this.fichiers.update((liste) => liste.filter((_, i) => i !== index));
    this.refus.set([]);
  }

  protected toutRetirer(): void {
    this.fichiers.set([]);
    this.refus.set([]);
  }

  protected importer(): void {
    if (this.envoi()) {
      return;
    }
    const fichiers = this.fichiers();
    const avantEnvoi = erreurAvantEnvoi(fichiers);
    if (avantEnvoi) {
      this.refus.set([avantEnvoi]);
      return;
    }
    this.erreur.set(null);
    this.refus.set([]);
    this.reponse.set(null);
    this.envoi.set(true);
    this.abonnements.add(
      this.service.importerLot(fichiers).subscribe({
        next: (reponse) => {
          this.envoi.set(false);
          this.reponse.set(reponse);
          this.fichiers.set([]);
          // Fiche d'un patient cree depuis l'ouverture de la page : on relit les identites.
          if (reponse.resultats.some((r) => r.patientId && !this.identites().has(r.patientId))) {
            this.chargerIdentites();
          }
        },
        error: (erreur: unknown) => {
          this.envoi.set(false);
          this.erreur.set(messageImportLot(erreur));
        },
      }),
    );
  }

  private ajouter(choisis: File[]): void {
    if (!choisis.length) {
      return;
    }
    const resultat = ajouterFichiers(this.fichiers(), choisis);
    this.fichiers.set(resultat.fichiers);
    this.refus.set(resultat.refus);
  }

  private ligne(resultat: ResultatImportResponse): LigneResultat {
    const statut = statutImport(resultat);
    return {
      index: resultat.index,
      nomFichier: resultat.nomFichier ?? '—',
      statut,
      libelleStatut: LIBELLES_STATUT_IMPORT[statut],
      patient: this.identite(resultat.patientId),
      message: messageResultatImport(resultat),
    };
  }

  private identite(patientId: string | undefined): string {
    if (!patientId) {
      return '—';
    }
    const patient = this.identites().get(patientId);
    if (!patient) {
      return 'Patient non trouvé dans la liste';
    }
    return patient.numeroDossierProxymed
      ? `${patient.nomComplet} (${patient.numeroDossierProxymed})`
      : patient.nomComplet;
  }

  /** Echec silencieux : la colonne patient l'indique, l'import reste possible. */
  private chargerIdentites(): void {
    this.abonnements.add(
      this.service.listerPatients().subscribe({
        next: (patients) => this.identites.set(new Map(patients.map((p) => [p.id, p]))),
        error: () => undefined,
      }),
    );
  }
}
