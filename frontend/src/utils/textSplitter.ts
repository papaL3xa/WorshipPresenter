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
        // Untuk lagu: TIDAK dipotong otomatis, setiap bait tampil utuh dalam 1 slide
        // Untuk Alkitab: dipotong jika terlalu panjang
        const MAX_LEN = 220;
        const shouldSplit = item.type === 'bible' && seg.length > MAX_LEN;

        if (shouldSplit) {
          let remaining = seg;
          let partIndex = 0;
          
          const originalLabel = item.segmentLabels ? item.segmentLabels[idx] : `Ayat ${idx+1}`;
          
          while (remaining.length > 0) {
            if (remaining.length <= MAX_LEN) {
              const newIdx = newSegments.length;
              newSegments.push(remaining.trim());
              if (wasVisible) newVisibleSegments.push(newIdx);
              newLabels.push(originalLabel);
              break;
            }
            
            let splitPos = -1;
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
          // Tidak dipotong — segmen tampil utuh
          const newIdx = newSegments.length;
          newSegments.push(seg);
          if (wasVisible) {
            newVisibleSegments.push(newIdx);
          }
          const defaultLabel = item.type === 'bible' ? `Ayat ${idx+1}` : `Bait ${idx+1}`;
          newLabels.push(item.segmentLabels ? item.segmentLabels[idx] : defaultLabel);
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
