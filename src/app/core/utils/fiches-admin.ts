import { TAILLE_MAX_FICHE_OCTETS, TYPE_PDF } from '../models/fiche-signee.model';
import {
  MAX_FICHES_IMPRESSION,
  MAX_FICHIERS_IMPORT,
  RESULTAT_IMPORTEE,
  ResultatImportResponse,
} from '../models/fiches-admin.model';

/*
 * Controles locaux du parcours admin : ils evitent un envoi voue a l'echec, le serveur reste
 * seul juge (il applique les memes limites).
 */

// ---------- Selection des patients (impression) ----------

export const MESSAGE_SELECTION_MAX = `Vous pouvez sélectionner au plus ${MAX_FICHES_IMPRESSION} patients par impression.`;

export interface ResultatSelection {
  selection: ReadonlySet<string>;
  /** Nombre de patients non ajoutes parce que la limite est atteinte. */
  ignores: number;
}

/** Coche ou decoche un patient ; refuse d'en cocher un de plus que la limite. */
export function basculerSelection(
  selection: ReadonlySet<string>,
  id: string,
  max = MAX_FICHES_IMPRESSION,
): ResultatSelection {
  const suivante = new Set(selection);
  if (suivante.has(id)) {
    suivante.delete(id);
    return { selection: suivante, ignores: 0 };
  }
  if (suivante.size >= max) {
    return { selection, ignores: 1 };
  }
  suivante.add(id);
  return { selection: suivante, ignores: 0 };
}

/** Ajoute plusieurs patients (ex. toute la page) dans l'ordre, jusqu'a la limite. */
export function ajouterASelection(
  selection: ReadonlySet<string>,
  ids: readonly string[],
  max = MAX_FICHES_IMPRESSION,
): ResultatSelection {
  const suivante = new Set(selection);
  let ignores = 0;
  for (const id of ids) {
    if (suivante.has(id)) {
      continue;
    }
    if (suivante.size >= max) {
      ignores++;
    } else {
      suivante.add(id);
    }
  }
  return { selection: suivante, ignores };
}

// ---------- Fichiers a importer ----------

export const TAILLE_MAX_FICHIER_LISIBLE = '10 Mo';

export const MESSAGE_FICHIERS_MAX = `Vous pouvez importer au plus ${MAX_FICHIERS_IMPORT} fichiers à la fois.`;

export function messageFichierNonPdf(nom: string): string {
  return `« ${nom} » n’est pas un PDF : seuls les fichiers PDF sont acceptés.`;
}

export function messageFichierVide(nom: string): string {
  return `« ${nom} » est vide.`;
}

export function messageFichierTropGros(nom: string): string {
  return `« ${nom} » dépasse la taille maximale de ${TAILLE_MAX_FICHIER_LISIBLE}. Scannez la fiche avec une résolution plus faible.`;
}

export function messageFichierEnDouble(nom: string): string {
  return `« ${nom} » est déjà dans la liste.`;
}

export function messageFichiersIgnores(nombre: number): string {
  return `${MESSAGE_FICHIERS_MAX} ${nombre} fichier${nombre > 1 ? 's n’ont' : ' n’a'} pas été ajouté${nombre > 1 ? 's' : ''}.`;
}

export interface ResultatAjoutFichiers {
  fichiers: File[];
  /** Un message par fichier refuse, a afficher avant tout envoi. */
  refus: string[];
}

/**
 * Type declare par le navigateur, ou extension .pdf quand il n'en declare aucun (le type
 * application/pdf est alors pose : le serveur l'exige). Sinon null.
 */
export function fichierPdf(fichier: File): File | null {
  if (fichier.type === TYPE_PDF) {
    return fichier;
  }
  if (!fichier.type && /\.pdf$/i.test(fichier.name)) {
    return new File([fichier], fichier.name, {
      type: TYPE_PDF,
      lastModified: fichier.lastModified,
    });
  }
  return null;
}

function cle(fichier: File): string {
  return `${fichier.name}|${fichier.size}|${fichier.lastModified}`;
}

/**
 * Ajoute les fichiers choisis a la liste en cours : PDF seulement, non vides, 10 Mo au plus
 * chacun, sans doublon, 20 au plus en tout. Les fichiers refuses sont expliques un par un.
 */
export function ajouterFichiers(
  existants: readonly File[],
  nouveaux: readonly File[],
  max = MAX_FICHIERS_IMPORT,
  tailleMax = TAILLE_MAX_FICHE_OCTETS,
): ResultatAjoutFichiers {
  const fichiers = [...existants];
  const cles = new Set(existants.map(cle));
  const refus: string[] = [];
  let horsLimite = 0;

  for (const brut of nouveaux) {
    const fichier = fichierPdf(brut);
    if (!fichier) {
      refus.push(messageFichierNonPdf(brut.name));
    } else if (fichier.size === 0) {
      refus.push(messageFichierVide(brut.name));
    } else if (fichier.size > tailleMax) {
      refus.push(messageFichierTropGros(brut.name));
    } else if (cles.has(cle(fichier))) {
      refus.push(messageFichierEnDouble(brut.name));
    } else if (fichiers.length >= max) {
      horsLimite++;
    } else {
      fichiers.push(fichier);
      cles.add(cle(fichier));
    }
  }
  if (horsLimite) {
    refus.push(messageFichiersIgnores(horsLimite));
  }
  return { fichiers, refus };
}

/** Derniere verification juste avant l'envoi (liste non vide, limites respectees). */
export function erreurAvantEnvoi(
  fichiers: readonly File[],
  max = MAX_FICHIERS_IMPORT,
  tailleMax = TAILLE_MAX_FICHE_OCTETS,
): string | null {
  if (!fichiers.length) {
    return 'Ajoutez au moins un fichier PDF à importer.';
  }
  if (fichiers.length > max) {
    return MESSAGE_FICHIERS_MAX;
  }
  const fautif = fichiers.find((f) => f.type !== TYPE_PDF || f.size === 0 || f.size > tailleMax);
  if (fautif) {
    return fautif.type !== TYPE_PDF
      ? messageFichierNonPdf(fautif.name)
      : fautif.size === 0
        ? messageFichierVide(fautif.name)
        : messageFichierTropGros(fautif.name);
  }
  return null;
}

// ---------- Resultats de l'import ----------

export type StatutImport = 'importe' | 'deja-importe' | 'erreur';

export const LIBELLES_STATUT_IMPORT: Record<StatutImport, string> = {
  importe: 'Importé',
  'deja-importe': 'Déjà importé',
  erreur: 'Erreur',
};

export function statutImport(resultat: ResultatImportResponse): StatutImport {
  if (resultat.resultat === RESULTAT_IMPORTEE) {
    return 'importe';
  }
  return resultat.code === 409 ? 'deja-importe' : 'erreur';
}
