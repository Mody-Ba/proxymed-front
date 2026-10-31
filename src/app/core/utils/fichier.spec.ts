import { nomFichierDepuisEntete, nomFichierSur, tailleLisible } from './fichier';

describe('fichier', () => {
  describe('nomFichierDepuisEntete', () => {
    it('lit filename entre guillemets', () => {
      expect(nomFichierDepuisEntete('attachment; filename="fiche-1.pdf"', 'defaut.pdf')).toBe(
        'fiche-1.pdf',
      );
    });

    it('prefere filename* (UTF-8) a filename', () => {
      expect(
        nomFichierDepuisEntete(
          'attachment; filename="fiche.pdf"; filename*=UTF-8\'\'fiche%20sign%C3%A9e.pdf',
          'defaut.pdf',
        ),
      ).toBe('fiche signée.pdf');
    });

    it('sans en-tete ou sans nom : nom par defaut', () => {
      expect(nomFichierDepuisEntete(null, 'defaut.pdf')).toBe('defaut.pdf');
      expect(nomFichierDepuisEntete('attachment', 'defaut.pdf')).toBe('defaut.pdf');
    });
  });

  describe('nomFichierSur', () => {
    it('retire le chemin et les caracteres interdits, ajoute .pdf', () => {
      expect(nomFichierSur('../../etc/pa:ss*wd', 'defaut.pdf')).toBe('passwd.pdf');
      expect(nomFichierSur('C:\\scans\\fiche?.PDF', 'defaut.pdf')).toBe('fiche.PDF');
    });

    it('rien d’exploitable : nom par defaut', () => {
      expect(nomFichierSur('...', 'defaut.pdf')).toBe('defaut.pdf');
      expect(nomFichierSur('', 'defaut.pdf')).toBe('defaut.pdf');
    });
  });

  it('tailleLisible : octets, Ko et Mo en francais', () => {
    expect(tailleLisible(1)).toBe('1 octet');
    expect(tailleLisible(512)).toBe('512 octets');
    expect(tailleLisible(1536)).toBe('1,5 Ko');
    expect(tailleLisible(2.5 * 1024 * 1024)).toBe('2,5 Mo');
  });
});
