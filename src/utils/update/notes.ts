/**
 * Turns a release's notes into the lines a banner can show.
 *
 * The notes are the `CHANGELOG.md` section verbatim — Markdown, headings and
 * all. Rendering that properly would mean a Markdown dependency for four lines
 * of text; reducing it to its bullet points says the same thing. The headings
 * are "Added"/"Changed"/"Fixed" and the reader is looking at a list of changes
 * either way, so everything that is not a list item is dropped.
 *
 * **A bullet is not a line.** That file is wrapped at a hundred characters, so
 * almost every entry runs over two or three lines with the rest indented
 * underneath. Reading only the lines that start with `- ` cut each one off
 * mid-sentence — the first update banner ever shown on a phone advertised
 * "wenn der Update-Hinweis mehr" and stopped there. An indented continuation
 * belongs to the bullet above it; a blank line or anything back at the left
 * margin ends the entry, so the next heading is not swallowed into it.
 */
export function bulletsFrom(notes: string): string[] {
  const bullets: string[] = [];
  let open = false;

  for (const line of notes.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      bullets.push(trimmed.slice(2));
      open = true;
    } else if (open && trimmed && line.startsWith(' ')) {
      bullets[bullets.length - 1] += ` ${trimmed}`;
    } else {
      open = false;
    }
  }

  return bullets.map((bullet) => bullet.replace(/\*\*/g, '').trim()).filter(Boolean);
}
