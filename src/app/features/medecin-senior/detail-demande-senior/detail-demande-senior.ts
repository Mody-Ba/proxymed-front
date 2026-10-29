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
import { DonneesDecision, IssueDecision, MESSAGE_CONFLIT } from '../decision';
import { DialogueAcceptation } from '../dialogue-acceptation/dialogue-acceptation';
import { DialogueRefus } from '../dialogue-refus/dialogue-refus';

interface MessagePage {
  type: TypeEncadre;
  texte: string;
}

/**
 * Detail d'une demande pour le medecin senior. Les boutons "Accepter" et "Refuser" n'apparaissent
 * que sur une demande EN_ATTENTE ; le serveur reste seul juge (409 si elle a ete traitee
 * entre-temps, 403 pour un autre role).
 */
@Component({
  selector: 'app-detail-demande-senior',
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
  templateUrl: './detail-demande-senior.html',
  styleUrl: './detail-demande-senior.scss',
})
export class DetailDemandeSenior implements OnInit {
  private readonly demandes = inject(DemandeConsultationService);
  private readonly dialogues = inject(MatDialog);
  private readonly injector = inject(Injector);

  /** Parametre :id de la route (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly demande = signal<DemandeConsultationResponse | null>(null);
  /** Premier chargement : la page entiere attend. */
  protected readonly enCours = signal(true);
  /** Rechargement apres une decision : le detail reste affiche. */
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

  protected accepter(demande: DemandeConsultationResponse): void {
    this.ouvrir(DialogueAcceptation, demande);
  }

  protected refuser(demande: DemandeConsultationResponse): void {
    this.ouvrir(DialogueRefus, demande);
  }

  private ouvrir(
    dialogue: typeof DialogueAcceptation | typeof DialogueRefus,
    demande: DemandeConsultationResponse,
  ): void {
    this.message.set(null);
    const donnees: DonneesDecision = { demandeId: demande.id, nomPatient: demande.nomPatient };
    this.dialogues
      .open<unknown, DonneesDecision, IssueDecision>(dialogue, {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((resultat) => {
        if (!resultat) {
          return;
        }
        this.message.set(
          resultat.issue === 'decidee'
            ? { type: 'succes', texte: resultat.message }
            : { type: 'avertissement', texte: MESSAGE_CONFLIT },
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
