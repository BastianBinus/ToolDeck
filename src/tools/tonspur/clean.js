// Whisper's best-known failure on silence or music: it "hears" the credits line
// from the subtitled TV it was trained on. These are never real content.
export const HALLUCINATIONS = [
  /Untertitel (im Auftrag des ZDF|der Amara\.org-Community|von Stephanie Geiges)[^.]*\.?/gi,
  /Subtitles by the Amara\.org community\.?/gi,
];

export function clean(text) {
  let t = text;
  for (const re of HALLUCINATIONS) t = t.replace(re, '');
  return t.replace(/\s+/g, ' ').trim();
}
