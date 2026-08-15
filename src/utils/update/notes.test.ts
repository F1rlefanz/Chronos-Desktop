import { describe, expect, it } from 'vitest';
import { bulletsFrom } from './notes';

/**
 * `CHANGELOG.md` is wrapped at a hundred characters, so nearly every entry in it
 * runs over two or three lines with the rest indented underneath. Reading only
 * the lines that begin with `- ` cut each one off mid-sentence — the very first
 * update banner shown on a real phone advertised "wenn der Update-Hinweis mehr"
 * and stopped there.
 */
describe('bulletsFrom', () => {
  it('keeps a bullet that wraps onto the next line whole', () => {
    const notes = [
      '### Fixed',
      '',
      '- **Etwas Langes** steht hier und läuft über das Zeilenende hinaus, weil die Datei bei',
      '  hundert Zeichen umbricht.',
      '- Ein kurzer.',
    ].join('\n');

    expect(bulletsFrom(notes)).toEqual([
      'Etwas Langes steht hier und läuft über das Zeilenende hinaus, weil die Datei bei hundert Zeichen umbricht.',
      'Ein kurzer.',
    ]);
  });

  it('keeps a bullet wrapped over three lines whole', () => {
    expect(bulletsFrom(['- Eins', '  zwei', '  drei'].join('\n'))).toEqual(['Eins zwei drei']);
  });

  it('does not glue the heading after a list onto the last bullet', () => {
    const notes = ['### Added', '', '- Etwas.', '', '### Fixed', '', '- Anderes.'].join('\n');
    expect(bulletsFrom(notes)).toEqual(['Etwas.', 'Anderes.']);
  });

  it('ignores a paragraph that is not part of any bullet', () => {
    const notes = ['Ein Vorspann.', '', '- Etwas.', '', 'Ein Nachsatz.'].join('\n');
    expect(bulletsFrom(notes)).toEqual(['Etwas.']);
  });

  it('strips the bold markers the changelog opens every entry with', () => {
    expect(bulletsFrom('- **Fett** und normal.')).toEqual(['Fett und normal.']);
  });

  it('has nothing to show for notes without a list', () => {
    expect(bulletsFrom('Nur ein Absatz.')).toEqual([]);
    expect(bulletsFrom('')).toEqual([]);
  });

  // The real thing, taken from the release that exposed the bug.
  it('reads the actual 1.1.1 release notes in one piece', () => {
    const notes = [
      '### Fixed',
      '',
      '- **„… und eine weitere Änderung"** statt „… und 1 weitere Änderungen", wenn der Update-Hinweis mehr',
      '  Punkte hat, als er zeigt.',
    ].join('\n');

    expect(bulletsFrom(notes)).toEqual([
      '„… und eine weitere Änderung" statt „… und 1 weitere Änderungen", wenn der Update-Hinweis mehr Punkte hat, als er zeigt.',
    ]);
  });
});
