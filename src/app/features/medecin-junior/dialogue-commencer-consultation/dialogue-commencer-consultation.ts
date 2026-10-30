import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import {
  ERREUR_CONSULTATION_NON_COMMENCABLE,
  ERREUR_PATIENT_EXISTANT,
  NUMERO_DOSSIER_MAX,
  Sexe,
} from '../../../core/models/demande-consultation.model';
import { MedecinFiche1Response } from '../../../core/models/medecin.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { MedecinService } from '../../../core/services/medecin.service';
import { detailsErreur, messageErreur, typeErreur } from '../../../core/utils/erreur-http';
import { datePassee, nonVide } from '../../../core/utils/validateurs';
import { Encadre } from '../../../shared/components/encadre/encadre';

export interface DonneesCommencement {
  demandeId: string;
  nomPatient: string;
}

/**
 * Valeur de fermeture (undefined = annule). 'conflit' : la demande ne peut plus etre commencee
 * (409 « Consultation impossible a commencer »), la page affiche le message du serveur et se relit.
 */
export type IssueCommencement = { issue: 'commencee' } | { issue: 'conflit'; message: string };

export const MESSAGE_ACCES_REFUSE_COMMENCEMENT =
  'Vous ne pouvez pas commencer cette consultation : la demande n’est pas assignée à votre compte.';
export const MESSAGE_AUCUN_SENIOR =
  'Aucun médecin senior n’est enregistré dans la Fiche 1 : la consultation ne peut pas être commencée pour le moment.';

/**
 * Saisie de ce que la demande ne fournit pas pour creer le patient et le brouillon de Fiche 1.
 * Le nom du patient et le motif viennent de la demande, cote serveur. L'appel part d'ici : une
 * erreur (400, 403, 404, numero de dossier deja utilise) reste affichee dans le dialogue.
 */
@Component({
  selector: 'app-dialogue-commencer-consultation',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    Encadre,
  ],
  templateUrl: './dialogue-commencer-consultation.html',
  styleUrls: ['../../../shared/styles/dialogue.scss', './dialogue-commencer-consultation.scss'],
})
export class DialogueCommencerConsultation implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly medecins = inject(MedecinService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogue =
    inject<MatDialogRef<DialogueCommencerConsultation, IssueCommencement>>(MatDialogRef);
  protected readonly donnees = inject<DonneesCommencement>(MAT_DIALOG_DATA);

  protected readonly numeroDossierMax = NUMERO_DOSSIER_MAX;
  protected readonly messageAucunSenior = MESSAGE_AUCUN_SENIOR;
  protected readonly sexes: readonly { valeur: Sexe; libelle: string }[] = [
    { valeur: 'F', libelle: 'Féminin (F)' },
    { valeur: 'M', libelle: 'Masculin (M)' },
  ];

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    numeroDossierProxymed: [
      '',
      [Validators.required, nonVide, Validators.maxLength(NUMERO_DOSSIER_MAX)],
    ],
    dateNaissance: ['', [Validators.required, datePassee]],
    sexe: ['' as Sexe | '', Validators.required],
    medecinSeniorId: [null as number | null, Validators.required],
  });

  protected readonly seniors = signal<MedecinFiche1Response[]>([]);
  protected readonly chargementSeniors = signal(true);
  protected readonly erreurSeniors = signal<string | null>(null);

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);

  ngOnInit(): void {
    this.chargerSeniors();
  }

  protected libelleSenior(senior: MedecinFiche1Response): string {
    return `${senior.prenom} ${senior.nom} (n° d’ordre ${senior.numeroOrdre})`;
  }

  protected chargerSeniors(): void {
    this.chargementSeniors.set(true);
    this.erreurSeniors.set(null);
    const abonnement = this.medecins.seniorsFiche1().subscribe({
      next: (seniors) => {
        this.chargementSeniors.set(false);
        this.seniors.set(seniors);
      },
      error: (erreur: unknown) => {
        this.chargementSeniors.set(false);
        this.erreurSeniors.set(
          messageErreur(erreur, 'La liste des médecins seniors n’a pas pu être chargée.'),
        );
      },
    });
    this.destroyRef.onDestroy(() => abonnement.unsubscribe());
  }

  protected commencer(): void {
    if (this.enCours() || !this.seniors().length) {
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.dialogue.disableClose = true;
    this.erreur.set(null);
    this.details.set([]);

    const saisie = this.formulaire.getRawValue();
    this.demandes
      .commencer(this.donnees.demandeId, {
        numeroDossierProxymed: saisie.numeroDossierProxymed.trim(),
        dateNaissance: saisie.dateNaissance,
        sexe: saisie.sexe as Sexe,
        medecinSeniorId: saisie.medecinSeniorId as number,
      })
      .subscribe({
        next: () => this.dialogue.close({ issue: 'commencee' }),
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.dialogue.disableClose = false;
          this.traiterErreur(erreur);
        },
      });
  }

  private traiterErreur(erreur: unknown): void {
    const status = erreur instanceof HttpErrorResponse ? erreur.status : null;
    const type = typeErreur(erreur);
    if (status === 409 && type === ERREUR_CONSULTATION_NON_COMMENCABLE) {
      this.dialogue.close({
        issue: 'conflit',
        message: messageErreur(erreur, 'Cette consultation ne peut plus être commencée.'),
      });
      return;
    }
    if (status === 409 && type === ERREUR_PATIENT_EXISTANT) {
      this.formulaire.controls.numeroDossierProxymed.setErrors({ dejaUtilise: true });
      this.formulaire.controls.numeroDossierProxymed.markAsTouched();
    }
    this.erreur.set(
      status === 403
        ? MESSAGE_ACCES_REFUSE_COMMENCEMENT
        : messageErreur(erreur, 'La consultation n’a pas pu être commencée.'),
    );
    this.details.set(detailsErreur(erreur));
  }
}
