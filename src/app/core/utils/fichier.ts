/** Caracteres interdits dans un nom de fichier (Windows, macOS, Linux) et caracteres de controle. */
// eslint-disable-next-line no-control-regex
const CARACTERES_INTERDITS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const LONGUEUR_NOM_MAX = 150;

/**
 * Nom propose par le serveur dans Content-Disposition (filename* RFC 5987 en priorite, puis
 * filename), nettoye. Sans nom exploitable : le nom par defaut.
 */
export function nomFichierDepuisEntete(entete: string | null, parDefaut: string): string {
  if (!entete) {
    return parDefaut;
  }
  let nom: string | null = null;
  const etendu = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(entete);
  if (etendu) {
    try {
      nom = decodeURIComponent(etendu[2].trim());
    } catch {
      nom = null;
    }
  }
  if (!nom) {
    const simple = /filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]+))/i.exec(entete);
    nom = simple ? (simple[1]?.replace(/\\(.)/g, '$1') ?? simple[2]?.trim() ?? null) : null;
  }
  return nomFichierSur(nom, parDefaut);
}

/** Nom sans chemin ni caractere interdit, toujours en .pdf ; le nom par defaut s'il ne reste rien. */
export function nomFichierSur(nom: string | null, parDefaut: string): string {
  const base = (nom ?? '').split(/[/\\]/).pop() ?? '';
  let propre = base
    .replace(CARACTERES_INTERDITS, '')
    .replace(/^[.\s]+/, '')
    .trim();
  if (!propre) {
    return parDefaut;
  }
  if (!/\.pdf$/i.test(propre)) {
    propre = `${propre}.pdf`;
  }
  if (propre.length > LONGUEUR_NOM_MAX) {
    propre = `${propre.slice(0, LONGUEUR_NOM_MAX - 4)}.pdf`;
  }
  return propre;
}

const FORMAT_DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Taille lisible en francais : octets, Ko ou Mo (base 1024, comme la limite du serveur). */
export function tailleLisible(octets: number): string {
  if (octets < 1024) {
    return `${octets} octet${octets > 1 ? 's' : ''}`;
  }
  if (octets < 1024 * 1024) {
    return `${FORMAT_DECIMAL.format(octets / 1024)} Ko`;
  }
  return `${FORMAT_DECIMAL.format(octets / (1024 * 1024))} Mo`;
}

/** Propose l'enregistrement du fichier par le navigateur, sans rien ecrire dans la console. */
export function enregistrerFichier(contenu: Blob, nomFichier: string): void {
  const adresse = URL.createObjectURL(contenu);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nomFichier;
  lien.rel = 'noopener';
  lien.style.display = 'none';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Liberation differee : certains navigateurs lisent l'adresse apres le clic.
  setTimeout(() => URL.revokeObjectURL(adresse), 0);
}
