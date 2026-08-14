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
        const MAX_LEN = item.type === 'bible' ? 220 : 999999; // Prevent auto-splitting for songs
        
        if (seg.length > MAX_LEN) {
          let remaining = seg;
          let partIndex = 0;
          
          const originalLabel = item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? `Ayat ${idx+1}` : `Bait ${idx+1}`);
          
          while (remaining.length > 0) {
            if (remaining.length <= MAX_LEN) {
              const newIdx = newSegments.length;
              newSegments.push(remaining.trim());
              if (wasVisible) newVisibleSegments.push(newIdx);
              newLabels.push(originalLabel);
              break;
            }
            
            let splitPos = -1;
            // Prioritaskan pemotongan di baris baru (\n) untuk lagu, baru tanda baca
            const punctuationMarks = ['\n', '. ', ', ', '; ', ': ', '? ', '! '];
            
            for (let p of punctuationMarks) {
              const pIdx = remaining.lastIndexOf(p, MAX_LEN);
              if (pIdx > MAX_LEN - 80) {
                splitPos = pIdx + 1;
                break;
              }
            }
            
            if (splitPos === -1) {
              splitPos = remaining.lastIndexOf(' ', MAX_LEN);
            }
            
            if (splitPos === -1 || splitPos < MAX_LEN - 80) {
              splitPos = MAX_LEN;
            }
            
            const part = remaining.substring(0, splitPos).trim();
            remaining = remaining.substring(splitPos).trim();
            
            const newIdx = newSegments.length;
            newSegments.push(part);
            if (wasVisible) newVisibleSegments.push(newIdx);
            newLabels.push(originalLabel);
            partIndex++;
          }
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
