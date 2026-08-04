export const splitLongSegments = (rawItems: any[]) => {
  let items = rawItems;
  if (!Array.isArray(items)) {
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    } else if (items && typeof items === 'object' && Array.isArray((items as any).items)) {
      items = (items as any).items;
    }
    if (!Array.isArray(items)) items = [];
  }
  
  return items.map(item => {
    if (typeof item !== 'object' || item === null) return item;
    if (!Array.isArray(item.segments)) item.segments = [];
    if ((item.type === 'bible' || item.type === 'song') && Array.isArray(item.segments)) {
      const newSegments: string[] = [];
      const newLabels: string[] = [];
      const newVisibleSegments: number[] = [];
      
      const oldVisibleSegments = Array.isArray(item.visibleSegments) ? item.visibleSegments : null;
      
      item.segments.forEach((seg: string, idx: number) => {
        const wasVisible = !oldVisibleSegments || oldVisibleSegments.includes(idx);
        
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
          
          const newIdx1 = newSegments.length;
          newSegments.push(part1);
          const newIdx2 = newSegments.length;
          newSegments.push(part2);
          
          if (wasVisible) {
            newVisibleSegments.push(newIdx1, newIdx2);
          }
          
          const originalLabel = item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? `Ayat ${idx+1}` : `Bait ${idx+1}`);
          const labelPrefix = originalLabel.replace(/a$|b$/, ''); // remove a or b if exists
          
          newLabels.push(`${labelPrefix}a`, `${labelPrefix}b`);
        } else {
          const newIdx = newSegments.length;
          newSegments.push(seg);
          if (wasVisible) {
            newVisibleSegments.push(newIdx);
          }
          newLabels.push(item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? `Ayat ${idx+1}` : `Bait ${idx+1}`));
        }
      });
      
      const resItem = { ...item, segments: newSegments, segmentLabels: newLabels };
      if (oldVisibleSegments) {
        resItem.visibleSegments = newVisibleSegments;
      }
      return resItem;
    }
    return item;
  });
};
