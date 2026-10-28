import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { MOTIF_MAX, NOM_PATIENT_MAX } from '../../../core/models/demande-consultation.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { detailsErreur, messageErreur } from '../../../core/utils/erreur-http';
import { nonVide } from '../../../core/utils/validateurs';

export const MESSAGE_DEMANDE_ENVOYEE = 'Votre demande a été envoyée.';

@Component({
  selector: 'app-nouvelle-demande',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './nouvelle-demande.html',
  styleUrls: ['../patient.scss', './nouvelle-demande.scss'],
})
export class NouvelleDemande {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly router = inject(Router);

  protected readonly nomPatientMax = NOM_PATIENT_MAX;
  protected readonly motifMax = MOTIF_MAX;

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    nomPatient: ['', [Validators.required, nonVide, Validators.maxLength(NOM_PATIENT_MAX)]],
    pourProche: [false],
    motif: ['', [Validators.required, nonVide, Validators.maxLength(MOTIF_MAX)]],
  });

  protected readonly pourProche = toSignal(this.formulaire.controls.pourProche.valueChanges, {
    initialValue: false,
  });
  protected readonly motifSaisi = toSignal(this.formulaire.controls.motif.valueChanges, {
    initialValue: '',
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly details = signal<string[]>([]);

  protected envoyer(): void {
    if (this.formulaire.invalid || this.enCours()) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.details.set([]);

    const { nomPatient, pourProche, motif } = this.formulaire.getRawValue();
    this.demandes
      .creer({ nomPatient: nomPatient.trim(), pourProche, motif: motif.trim() })
      .subscribe({
        next: () => {
          this.enCours.set(false);
          this.demandes.annoncerSurListe(MESSAGE_DEMANDE_ENVOYEE);
          void this.router.navigateByUrl('/patient/mes-demandes');
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(erreur));
          this.details.set(detailsErreur(erreur));
        },
      });
  }
}
