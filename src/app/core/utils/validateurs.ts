import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Comme @NotBlank cote serveur : un texte fait seulement d'espaces est considere comme vide. */
export const nonVide: ValidatorFn = (controle: AbstractControl): ValidationErrors | null =>
  typeof controle.value === 'string' && controle.value.length && !controle.value.trim()
    ? { required: true }
    : null;

/**
 * Comme @Past cote serveur, pour une date "AAAA-MM-JJ" (champ <input type="date">) : la date
 * doit etre strictement anterieure a aujourd'hui.
 */
export const datePassee: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const valeur = controle.value;
  if (typeof valeur !== 'string' || !valeur) {
    return null;
  }
  const maintenant = new Date();
  const aujourdhui = [
    maintenant.getFullYear(),
    String(maintenant.getMonth() + 1).padStart(2, '0'),
    String(maintenant.getDate()).padStart(2, '0'),
  ].join('-');
  return valeur < aujourdhui ? null : { datePassee: true };
};
