import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MESSAGE_MOTIF_OBLIGATOIRE,
  MESSAGE_MOTIF_TROP_LONG,
} from '../../../core/utils/visa-fiches';
import { DialogueRenvoiFiches } from './dialogue-renvoi-fiches';

describe('DialogueRenvoiFiches', () => {
  let fixture: ComponentFixture<DialogueRenvoiFiches>;
  let fermer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fermer = vi.fn();
    TestBed.configureTestingModule({
      imports: [DialogueRenvoiFiches],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { nombre: 3 } },
        { provide: MatDialogRef, useValue: { close: fermer } },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(DialogueRenvoiFiches);
    fixture.detectChanges();
  });

  function saisir(texte: string): void {
    const champ = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    champ.value = texte;
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function envoyer(): void {
    (fixture.nativeElement.querySelector('.confirmer-renvoi') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function texte(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('rappelle le nombre de fiches', () => {
    expect(texte()).toContain('3 fiches');
  });

  it('refuse un motif vide ou fait d’espaces', () => {
    envoyer();
    expect(fermer).not.toHaveBeenCalled();
    expect(texte()).toContain(MESSAGE_MOTIF_OBLIGATOIRE);

    saisir('    ');
    envoyer();
    expect(fermer).not.toHaveBeenCalled();
    expect(texte()).toContain(MESSAGE_MOTIF_OBLIGATOIRE);
  });

  it('compte les caracteres et refuse plus de 1000', () => {
    saisir('a'.repeat(1001));
    expect(texte()).toContain('1001 / 1000');
    envoyer();
    expect(fermer).not.toHaveBeenCalled();
    expect(texte()).toContain(MESSAGE_MOTIF_TROP_LONG);
  });

  it('accepte 1000 caracteres et se ferme sur le motif sans espaces autour', () => {
    saisir('a'.repeat(1000));
    expect(texte()).toContain('1000 / 1000');
    envoyer();
    expect(fermer).toHaveBeenCalledWith('a'.repeat(1000));

    fermer.mockClear();
    saisir('  Code QR illisible  ');
    envoyer();
    expect(fermer).toHaveBeenCalledWith('Code QR illisible');
  });
});
