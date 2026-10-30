import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DemandeConsultationResponse } from '../../../core/models/demande-consultation.model';
import { DemandeConsultationService } from '../../../core/services/demande-consultation.service';
import { messageChargementDemande } from '../../../core/utils/erreur-http';
import { Encadre, TypeEncadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { EtatVide } from '../../../shared/components/etat-vide/etat-vide';
import { FicheDemande } from '../../../shared/components/fiche-demande/fiche-demande';
import {
  DialogueCommencerConsultation,
  DonneesCommencement,
  IssueCommencement,
} from '../dialogue-commencer-consultation/dialogue-commencer-consultation';

export const MESSAGE_CONSULTATION_COMMENCEE =
  'La consultation initiale a été commencée : le patient et le brouillon de la Fiche 1 ont été créés.';

interface MessagePage {
  type: TypeEncadre;
  texte: string;
}

/**
 * Detail d'une demande assignee au junior. Seule action : commencer la consultation initiale
 * d'une demande ACCEPTEE qui n'a pas encore de consultation. Le serveur repond 403 si la demande
 * n'est pas assignee a ce junior, et reste seul juge (409 si elle ne peut plus etre commencee).
 */
@Component({
  selector: 'app-detail-demande-junior',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    Encadre,
    EntetePage,
    EtatVide,
    FicheDemande,
  ],
  templateUrl: './detail-demande-junior.html',
  styleUrl: './detail-demande-junior.scss',
})
export class DetailDemandeJunior implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly dialogues = inject(MatDialog);
  private readonly injector = inject(Injector);

  /** Parametre :id de la route (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly demande = signal<DemandeConsultationResponse | null>(null);
  /** Premier chargement : la page entiere attend. */
  protected readonly enCours = signal(true);
  /** Rechargement apres le commencement : le detail reste affiche. */
  protected readonly rafraichissement = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly message = signal<MessagePage | null>(null);

  private readonly zoneMessage = viewChild('zoneMessage', { read: ElementRef });
  private abonnement: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abonnement?.unsubscribe());
  }

  ngOnInit(): void {
    this.charger();
  }

  protected peutCommencer(demande: DemandeConsultationResponse): boolean {
    return demande.statut === 'ACCEPTEE' && !demande.consultationId;
  }

  protected commencer(demande: DemandeConsultationResponse): void {
    this.message.set(null);
    this.dialogues
      .open<DialogueCommencerConsultation, DonneesCommencement, IssueCommencement>(
        DialogueCommencerConsultation,
        {
          data: { demandeId: demande.id, nomPatient: demande.nomPatient },
          width: '560px',
          maxWidth: 'calc(100vw - 32px)',
        },
      )
      .afterClosed()
      .subscribe((resultat) => {
        if (!resultat) {
          return;
        }
        this.message.set(
          resultat.issue === 'commencee'
            ? { type: 'succes', texte: MESSAGE_CONSULTATION_COMMENCEE }
            : { type: 'avertissement', texte: resultat.message },
        );
        this.charger();
        this.focaliserMessage();
      });
  }

  private charger(): void {
    this.abonnement?.unsubscribe();
    const dejaAffichee = this.demande() !== null;
    if (dejaAffichee) {
      this.rafraichissement.set(true);
    }
    this.abonnement = this.demandes.findById(this.id()).subscribe({
      next: (demande) => {
        this.enCours.set(false);
        this.rafraichissement.set(false);
        this.demande.set(demande);
      },
      error: (erreur: unknown) => {
        this.enCours.set(false);
        this.rafraichissement.set(false);
        if (dejaAffichee) {
          this.message.set({
            type: 'erreur',
            texte: 'La demande n’a pas pu être actualisée. Rechargez la page.',
          });
        } else {
          this.erreur.set(messageChargementDemande(erreur));
        }
      },
    });
  }

  /** Le bouton qui a ouvert le dialogue disparait : le focus va sur le message annonce. */
  private focaliserMessage(): void {
    afterNextRender(() => (this.zoneMessage()?.nativeElement as HTMLElement | undefined)?.focus(), {
      injector: this.injector,
    });
  }
}
