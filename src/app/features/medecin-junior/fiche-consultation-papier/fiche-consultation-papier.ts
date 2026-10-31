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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import {
  FicheSigneeResponse,
  TAILLE_MAX_FICHE_OCTETS,
  TYPE_PDF,
} from '../../../core/models/fiche-signee.model';
import { FicheConsultationService } from '../../../core/services/fiche-consultation.service';
import {
  estConflit,
  estIntrouvable,
  messageImportFiche,
  messageTelechargementFiche,
} from '../../../core/utils/erreur-http';
import { enregistrerFichier, tailleLisible } from '../../../core/utils/fichier';
import { Encadre, TypeEncadre } from '../../../shared/components/encadre/encadre';

export const MESSAGE_FICHE_IMPORTEE =
  'La fiche remplie a été importée et rangée dans le dossier du patient.';
export const MESSAGE_FICHIER_NON_PDF =
  'Le fichier choisi n’est pas un PDF. Choisissez le scan de la fiche au format PDF.';
export const MESSAGE_FICHIER_VIDE = 'Le fichier choisi est vide. Choisissez le scan de la fiche.';
export const MESSAGE_FICHIER_TROP_VOLUMINEUX =
  'Le fichier choisi dépasse la taille maximale de 10 Mo. Scannez la fiche avec une résolution plus faible puis réessayez.';
export const MESSAGE_VERIFICATION_IMPOSSIBLE =
  'La présence d’une fiche déjà importée n’a pas pu être vérifiée. Rechargez la page.';

interface MessageFiche {
  type: TypeEncadre;
  texte: string;
}

type EtatVerification = 'en-cours' | 'terminee' | 'echec';

/**
 * Fiche 1 sur papier d'une consultation commencee : le junior telecharge la fiche (avec son code
 * QR), la remplit a la main, puis importe le scan. Les controles locaux (PDF, 10 Mo) evitent un
 * envoi inutile ; le serveur reste seul juge (assignation, code QR, fiche deja importee).
 */
@Component({
  selector: 'app-fiche-consultation-papier',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    Encadre,
  ],
  templateUrl: './fiche-consultation-papier.html',
  styleUrl: './fiche-consultation-papier.scss',
})
export class FicheConsultationPapier implements OnInit {
  private readonly fiches = inject(FicheConsultationService);
  private readonly injector = inject(Injector);

  readonly consultationId = input.required<string>();

  protected readonly ficheSignee = signal<FicheSigneeResponse | null>(null);
  protected readonly verification = signal<EtatVerification>('en-cours');
  protected readonly telechargement = signal(false);
  protected readonly telechargementScan = signal(false);
  protected readonly envoi = signal(false);
  protected readonly message = signal<MessageFiche | null>(null);

  protected readonly tailleLisible = tailleLisible;
  protected readonly messageVerificationImpossible = MESSAGE_VERIFICATION_IMPOSSIBLE;

  private readonly zoneMessage = viewChild('zoneMessage', { read: ElementRef });
  private readonly abonnements = new Subscription();
  private abonnementVerification: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.abonnements.unsubscribe();
      this.abonnementVerification?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.verifierFicheImportee();
  }

  protected telechargerFiche(): void {
    if (this.telechargement()) {
      return;
    }
    this.message.set(null);
    this.telechargement.set(true);
    this.abonnements.add(
      this.fiches.telechargerFiche(this.consultationId()).subscribe({
        next: (fichier) => {
          this.telechargement.set(false);
          enregistrerFichier(fichier.contenu, fichier.nomFichier);
        },
        error: (erreur: unknown) => {
          this.telechargement.set(false);
          this.afficher('erreur', messageTelechargementFiche(erreur, false));
        },
      }),
    );
  }

  protected telechargerScan(): void {
    if (this.telechargementScan()) {
      return;
    }
    this.message.set(null);
    this.telechargementScan.set(true);
    this.abonnements.add(
      this.fiches.telechargerFicheSignee(this.consultationId()).subscribe({
        next: (fichier) => {
          this.telechargementScan.set(false);
          enregistrerFichier(fichier.contenu, fichier.nomFichier);
        },
        error: (erreur: unknown) => {
          this.telechargementScan.set(false);
          this.afficher('erreur', messageTelechargementFiche(erreur, true));
        },
      }),
    );
  }

  protected fichierChoisi(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0] ?? null;
    // Remis a zero : le meme fichier peut etre choisi de nouveau apres correction.
    champ.value = '';
    if (!fichier || this.envoi()) {
      return;
    }
    const aEnvoyer = this.fichierPdf(fichier);
    if (!aEnvoyer) {
      this.afficher('erreur', MESSAGE_FICHIER_NON_PDF);
    } else if (aEnvoyer.size === 0) {
      this.afficher('erreur', MESSAGE_FICHIER_VIDE);
    } else if (aEnvoyer.size > TAILLE_MAX_FICHE_OCTETS) {
      this.afficher('erreur', MESSAGE_FICHIER_TROP_VOLUMINEUX);
    } else {
      this.importer(aEnvoyer);
    }
  }

  private importer(fichier: File): void {
    this.message.set(null);
    this.envoi.set(true);
    this.abonnements.add(
      this.fiches.importer(fichier).subscribe({
        next: (fiche) => {
          this.envoi.set(false);
          this.ficheSignee.set(fiche);
          this.verification.set('terminee');
          this.afficher('succes', MESSAGE_FICHE_IMPORTEE);
        },
        error: (erreur: unknown) => {
          this.envoi.set(false);
          this.afficher('erreur', messageImportFiche(erreur));
          if (estConflit(erreur)) {
            // Deja importee (ailleurs ou par un autre onglet) : on affiche celle du serveur.
            this.verifierFicheImportee();
          }
        },
      }),
    );
  }

  /**
   * Type declare par le navigateur, ou extension .pdf quand il n'en declare aucun : le serveur
   * exige le type application/pdf, il est alors pose ici (il verifie aussi la signature %PDF-).
   */
  private fichierPdf(fichier: File): File | null {
    if (fichier.type === TYPE_PDF) {
      return fichier;
    }
    if (!fichier.type && /\.pdf$/i.test(fichier.name)) {
      return new File([fichier], fichier.name, { type: TYPE_PDF });
    }
    return null;
  }

  /** Aucune fiche importee (liste vide ou 404) est l'etat normal : rien n'est affiche. */
  private verifierFicheImportee(): void {
    this.abonnementVerification?.unsubscribe();
    this.verification.set('en-cours');
    this.abonnementVerification = this.fiches
      .ficheSigneeDeLaConsultation(this.consultationId())
      .subscribe({
        next: (fiche) => {
          this.ficheSignee.set(fiche);
          this.verification.set('terminee');
        },
        error: (erreur: unknown) => {
          if (estIntrouvable(erreur)) {
            this.ficheSignee.set(null);
            this.verification.set('terminee');
            return;
          }
          this.verification.set('echec');
        },
      });
  }

  private afficher(type: TypeEncadre, texte: string): void {
    this.message.set({ type, texte });
    afterNextRender(() => (this.zoneMessage()?.nativeElement as HTMLElement | undefined)?.focus(), {
      injector: this.injector,
    });
  }
}
