const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const transposeChord = (chord: string, semitones: number): string => {
  if (!chord || semitones === 0) return chord;
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;
  const root = match[1];
  const suffix = match[2];

  let idx = NOTES_SHARP.indexOf(root);
  if (idx === -1) idx = NOTES_FLAT.indexOf(root);
  if (idx === -1) return chord;

  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;

  const preferFlat = root.includes('b') || ['F', 'Bb', 'Eb', 'Ab'].includes(root);
  const newRoot = preferFlat ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];
  return newRoot + suffix;
};

export const transposeTextChords = (text: string, semitones: number): string => {
  if (!text || semitones === 0) return text;
  return text.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]/g, (match, chord) => {
    if (chord.includes('/')) {
      const parts = chord.split('/');
      const transposedRoot = transposeChord(parts[0], semitones);
      const transposedBass = transposeChord(parts[1], semitones);
      return `[${transposedRoot}/${transposedBass}]`;
    }
    return `[${transposeChord(chord, semitones)}]`;
  });
};

export const transposeSongKey = (key: string, semitones: number): string => {
  if (!key || semitones === 0) return key;
  return transposeChord(key.trim(), semitones);
};
