import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Comme @NotBlank cote serveur : un texte fait seulement d'espaces est considere comme vide. */
export const nonVide: ValidatorFn = (controle: AbstractControl): ValidationErrors | null =>
  typeof controle.value === 'string' && controle.value.length && !controle.value.trim()
    ? { required: true }
    : null;
