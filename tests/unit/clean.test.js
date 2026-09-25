import { describe, it, expect } from 'vitest';
import { clean, HALLUCINATIONS } from '../../src/tools/tonspur/clean.js';

describe('HALLUCINATIONS', () => {
  it('is a list of regular expressions', () => {
    expect(Array.isArray(HALLUCINATIONS)).toBe(true);
    expect(HALLUCINATIONS.length).toBeGreaterThan(0);
    for (const re of HALLUCINATIONS) expect(re).toBeInstanceOf(RegExp);
  });
});

describe('clean', () => {
  it('removes the ZDF subtitle credit on its own', () => {
    expect(clean('Untertitel im Auftrag des ZDF, 2021.')).toBe('');
    expect(clean(' Untertitel im Auftrag des ZDF für funk, 2017 ')).toBe('');
  });

  it('removes the ZDF credit but keeps the speech around it', () => {
    expect(clean('Das war es für heute. Untertitel im Auftrag des ZDF, 2020. Tschüss!')).toBe(
      'Das war es für heute. Tschüss!',
    );
    expect(clean('Hallo zusammen. untertitel im auftrag des zdf für funk, 2019')).toBe('Hallo zusammen.');
  });

  it('removes Amara.org credits in German and English', () => {
    expect(clean('Untertitel der Amara.org-Community')).toBe('');
    expect(clean('Subtitles by the Amara.org community')).toBe('');
    expect(clean('Thanks for watching. Subtitles by the Amara.org community.')).toBe('Thanks for watching.');
    expect(clean('Untertitel von Stephanie Geiges.')).toBe('');
  });

  it('collapses whitespace and trims', () => {
    expect(clean('  Hallo \n\n  Welt\t, wie   geht es?  ')).toBe('Hallo Welt , wie geht es?');
    expect(clean('   ')).toBe('');
    expect(clean('')).toBe('');
  });

  it('leaves normal speech intact', () => {
    const normal = [
      'Heute sprechen wir über Untertitel im Fernsehen.',
      'Das ZDF sendet um 19 Uhr die Nachrichten.',
      'Amara ist ein schöner Name.',
      'We will add subtitles by the end of the week.',
    ];
    for (const s of normal) expect(clean(s)).toBe(s);
  });

  it('gives the same result on repeated calls (global regex state)', () => {
    const input = 'A. Untertitel im Auftrag des ZDF, 2021. B.';
    expect(clean(input)).toBe('A. B.');
    expect(clean(input)).toBe('A. B.');
    expect(clean(input)).toBe('A. B.');
  });
});
