import { TAILLE_MAX_FICHE_OCTETS } from '../models/fiche-signee.model';
import { MAX_FICHES_IMPRESSION, MAX_FICHIERS_IMPORT } from '../models/fiches-admin.model';
import {
  MESSAGE_IMPORT_DEJA_IMPORTEE,
  MESSAGE_IMPORT_QR_INTROUVABLE,
  MESSAGE_RESULTAT_IMPORTEE,
  MESSAGE_RESULTAT_REIMPORTEE,
  messageResultatImport,
} from './erreur-http';
import {
  ajouterASelection,
  ajouterFichiers,
  basculerSelection,
  erreurAvantEnvoi,
  MESSAGE_FICHIERS_MAX,
  messageFichierEnDouble,
  messageFichierNonPdf,
  messageFichiersIgnores,
  messageFichierTropGros,
  messageFichierVide,
  statutImport,
} from './fiches-admin';

let compteur = 0;

function fichier(nom: string, type = 'application/pdf', taille = 1024): File {
  const f = new File(['%PDF-1.7'], nom, { type, lastModified: ++compteur });
  Object.defineProperty(f, 'size', { value: taille });
  return f;
}

function ids(n: number, prefixe = 'p'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefixe}-${i}`);
}

describe('Selection des patients (max 50)', () => {
  it('la limite par defaut est celle du serveur', () => {
    expect(MAX_FICHES_IMPRESSION).toBe(50);
  });

  it('coche puis decoche un patient', () => {
    const coche = basculerSelection(new Set(), 'p-1');
    expect([...coche.selection]).toEqual(['p-1']);
    expect(coche.ignores).toBe(0);

    const decoche = basculerSelection(coche.selection, 'p-1');
    expect(decoche.selection.size).toBe(0);
  });

  it('accepte le 50e patient et refuse le 51e', () => {
    const quaranteNeuf = new Set(ids(49));
    const cinquante = basculerSelection(quaranteNeuf, 'p-49');
    expect(cinquante.selection.size).toBe(50);
    expect(cinquante.ignores).toBe(0);

    const refuse = basculerSelection(cinquante.selection, 'p-50');
    expect(refuse.selection.size).toBe(50);
    expect(refuse.selection.has('p-50')).toBe(false);
    expect(refuse.ignores).toBe(1);
  });

  it('a la limite, decocher reste possible', () => {
    const pleine = new Set(ids(50));
    expect(basculerSelection(pleine, 'p-0').selection.size).toBe(49);
  });

  it("ajouter une page s'arrete a 50 et compte les patients ignores", () => {
    const resultat = ajouterASelection(new Set(ids(45)), ids(10, 'q'));
    expect(resultat.selection.size).toBe(50);
    expect(resultat.ignores).toBe(5);
    expect(resultat.selection.has('q-4')).toBe(true);
    expect(resultat.selection.has('q-5')).toBe(false);
  });

  it('ajouter une page deja cochee ne compte aucun ignore', () => {
    const resultat = ajouterASelection(new Set(ids(50)), ids(10));
    expect(resultat.selection.size).toBe(50);
    expect(resultat.ignores).toBe(0);
  });
});

describe('Fichiers a importer (20 fichiers, 10 Mo chacun)', () => {
  it('les limites sont celles du serveur', () => {
    expect(MAX_FICHIERS_IMPORT).toBe(20);
    expect(TAILLE_MAX_FICHE_OCTETS).toBe(10 * 1024 * 1024);
  });

  it('accepte des PDF valides', () => {
    const r = ajouterFichiers([], [fichier('a.pdf'), fichier('b.pdf')]);
    expect(r.fichiers.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(r.refus).toEqual([]);
  });

  it('refuse un fichier qui n’est pas un PDF', () => {
    const r = ajouterFichiers([], [fichier('photo.jpg', 'image/jpeg')]);
    expect(r.fichiers).toEqual([]);
    expect(r.refus).toEqual([messageFichierNonPdf('photo.jpg')]);
  });

  it('accepte un .pdf sans type declare et lui pose application/pdf', () => {
    const r = ajouterFichiers([], [fichier('scan.PDF', '')]);
    expect(r.fichiers[0].type).toBe('application/pdf');
  });

  it('refuse un fichier vide', () => {
    const r = ajouterFichiers([], [fichier('vide.pdf', 'application/pdf', 0)]);
    expect(r.refus).toEqual([messageFichierVide('vide.pdf')]);
  });

  it('accepte exactement 10 Mo et refuse 10 Mo + 1 octet', () => {
    const r = ajouterFichiers(
      [],
      [
        fichier('limite.pdf', 'application/pdf', TAILLE_MAX_FICHE_OCTETS),
        fichier('gros.pdf', 'application/pdf', TAILLE_MAX_FICHE_OCTETS + 1),
      ],
    );
    expect(r.fichiers.map((f) => f.name)).toEqual(['limite.pdf']);
    expect(r.refus).toEqual([messageFichierTropGros('gros.pdf')]);
  });

  it('refuse un fichier deja dans la liste', () => {
    const a = fichier('a.pdf');
    const r = ajouterFichiers([a], [a]);
    expect(r.fichiers.length).toBe(1);
    expect(r.refus).toEqual([messageFichierEnDouble('a.pdf')]);
  });

  it('accepte le 20e fichier et ignore les suivants avec un message', () => {
    const existants = Array.from({ length: 18 }, (_, i) => fichier(`f${i}.pdf`));
    const r = ajouterFichiers(existants, [
      fichier('x.pdf'),
      fichier('y.pdf'),
      fichier('z1.pdf'),
      fichier('z2.pdf'),
    ]);
    expect(r.fichiers.length).toBe(20);
    expect(r.fichiers.at(-1)!.name).toBe('y.pdf');
    expect(r.refus).toEqual([messageFichiersIgnores(2)]);
  });

  it('verifie la liste avant l’envoi', () => {
    expect(erreurAvantEnvoi([])).toContain('au moins un fichier');
    expect(erreurAvantEnvoi(Array.from({ length: 21 }, (_, i) => fichier(`f${i}.pdf`)))).toBe(
      MESSAGE_FICHIERS_MAX,
    );
    expect(
      erreurAvantEnvoi([fichier('g.pdf', 'application/pdf', TAILLE_MAX_FICHE_OCTETS + 1)]),
    ).toBe(messageFichierTropGros('g.pdf'));
    expect(erreurAvantEnvoi([fichier('t.txt', 'text/plain')])).toBe(messageFichierNonPdf('t.txt'));
    expect(erreurAvantEnvoi(Array.from({ length: 20 }, (_, i) => fichier(`f${i}.pdf`)))).toBeNull();
  });
});

describe("Resultats de l'import en lot", () => {
  it('traduit statut et message de chaque fichier', () => {
    const importee = { index: 0, nomFichier: 'a.pdf', resultat: 'IMPORTEE' as const, code: 201 };
    expect(statutImport(importee)).toBe('importe');
    expect(messageResultatImport(importee)).toBe(MESSAGE_RESULTAT_IMPORTEE);
    expect(messageResultatImport({ ...importee, reimportee: true })).toBe(
      MESSAGE_RESULTAT_REIMPORTEE,
    );

    const deja = {
      index: 1,
      nomFichier: 'b.pdf',
      resultat: 'ERREUR' as const,
      code: 409,
      erreur: 'Fiche signee deja importee',
    };
    expect(statutImport(deja)).toBe('deja-importe');
    expect(messageResultatImport(deja)).toBe(MESSAGE_IMPORT_DEJA_IMPORTEE);

    const sansQr = { ...deja, code: 422, erreur: 'Code QR introuvable' };
    expect(statutImport(sansQr)).toBe('erreur');
    expect(messageResultatImport(sansQr)).toBe(MESSAGE_IMPORT_QR_INTROUVABLE);
  });
});
