export const splitLongSegments = (items: any[]) => {
  return items.map(item => {
    if (item.type === 'bible' || item.type === 'song') {
      const newSegments: string[] = [];
      const newLabels: string[] = [];
      
      item.segments.forEach((seg: string, idx: number) => {
        if (seg.length > 220) {
          // Split at the nearest sentence boundary or space around the middle
          const mid = Math.floor(seg.length / 2);
          
          // Try to find a period or comma near the middle
          let splitIndex = -1;
          const punctuationMarks = ['. ', ', ', '; ', ': ', '? ', '! '];
          
          for (let p of punctuationMarks) {
            const pIdx = seg.indexOf(p, mid - 50);
            if (pIdx !== -1 && pIdx < mid + 80) {
              splitIndex = pIdx + 1; // split after the punctuation
              break;
            }
          }
          
          if (splitIndex === -1) {
            splitIndex = seg.indexOf(' ', mid);
          }
          
          if (splitIndex === -1) {
            splitIndex = mid;
          }
          
          const part1 = seg.substring(0, splitIndex).trim();
          const part2 = seg.substring(splitIndex).trim();
          
          newSegments.push(part1, part2);
          
          const originalLabel = item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? `Ayat ${idx+1}` : `Bait ${idx+1}`);
          const labelPrefix = originalLabel.replace(/a$|b$/, ''); // remove a or b if exists
          
          newLabels.push(`${labelPrefix}a`, `${labelPrefix}b`);
        } else {
          newSegments.push(seg);
          newLabels.push(item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? `Ayat ${idx+1}` : `Bait ${idx+1}`));
        }
      });
      return { ...item, segments: newSegments, segmentLabels: newLabels };
    }
    return item;
  });
};
