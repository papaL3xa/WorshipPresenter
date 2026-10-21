/**
 * Helper to detect and handle song chorus/refrain embedding for worship rundowns
 */

export function isChorusSegment(label?: string, text?: string): boolean {
  if (label) {
    const l = label.toLowerCase().trim();
    if (
      l === 'chorus' ||
      l.startsWith('chorus') ||
      l.includes('reff') ||
      l.includes('refrein') ||
      l.includes('koor')
    ) {
      return true;
    }
  }
  if (text) {
    const firstLine = text.trim().split('\n')[0].toLowerCase().trim();
    if (/^(chorus|reff|refrein|koor)\b/i.test(firstLine)) {
      return true;
    }
  }
  return false;
}

export function hasChorus(song: any): boolean {
  if (!song || !song.segments || song.segments.length < 2) return false;
  const labels = song.segmentLabels || [];
  return song.segments.some((seg: string, idx: number) => isChorusSegment(labels[idx], seg));
}

export function findChorusIndex(segments: string[], segmentLabels?: string[]): number {
  if (!segments || segments.length === 0) return -1;
  return segments.findIndex((seg, idx) => {
    const lbl = segmentLabels?.[idx];
    return isChorusSegment(lbl, seg);
  });
}

/**
 * Checks if chorus is already embedded after every verse
 */
export function isChorusAlreadyEmbedded(segments: string[], segmentLabels?: string[]): boolean {
  const labels = segmentLabels || [];
  const chorusIndices = segments
    .map((seg, idx) => (isChorusSegment(labels[idx], seg) ? idx : -1))
    .filter((idx) => idx !== -1);

  if (chorusIndices.length <= 1) return false;

  for (let i = 0; i < segments.length; i++) {
    const lbl = (labels[i] || '').trim();
    const isNonVerse = /^(judul|title|intro|ending|outro|coda|penutup|amin|chorus|reff|refrein|koor)\b/i.test(lbl);
    if (!isNonVerse) {
      const nextIdx = i + 1;
      if (nextIdx >= segments.length || !isChorusSegment(labels[nextIdx], segments[nextIdx])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Expands song segments so chorus is inserted after each verse (Bait)
 */
export function expandSongWithChorus(item: any): any {
  if (!item || !item.segments || item.segments.length < 2) return item;

  const rawLabels =
    item.segmentLabels && item.segmentLabels.length === item.segments.length
      ? [...item.segmentLabels]
      : item.segments.map((_: any, i: number) => `Slide ${i + 1}`);

  const chorusIdx = findChorusIndex(item.segments, rawLabels);
  if (chorusIdx === -1) return item;

  // If already embedded, return item as-is
  if (isChorusAlreadyEmbedded(item.segments, rawLabels)) return item;

  const chorusText = item.segments[chorusIdx];
  const chorusLabel = rawLabels[chorusIdx] || 'Chorus';

  const newSegments: string[] = [];
  const newLabels: string[] = [];

  for (let i = 0; i < item.segments.length; i++) {
    const text = item.segments[i];
    const label = rawLabels[i] || `Slide ${i + 1}`;

    if (isChorusSegment(label, text)) {
      continue;
    }

    newSegments.push(text);
    newLabels.push(label);

    const isNonVerse = /^(judul|title|intro|ending|outro|coda|penutup|amin)\b/i.test(label.trim());
    if (!isNonVerse) {
      newSegments.push(chorusText);
      newLabels.push(chorusLabel);
    }
  }

  if (newSegments.length === 0) return item;

  return {
    ...item,
    segments: newSegments,
    segmentLabels: newLabels,
    visibleSegments: newSegments.map((_, i) => i)
  };
}
