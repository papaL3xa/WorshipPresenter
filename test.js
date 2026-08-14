const splitLongSegments = (rawItems) => {
  let items = rawItems;
  return items.map(item => {
    if (typeof item !== 'object' || item === null) return item;
    if (!Array.isArray(item.segments)) item.segments = [];
    if ((item.type === 'bible' || item.type === 'song') && Array.isArray(item.segments)) {
      const newSegments = [];
      const newLabels = [];
      const newVisibleSegments = [];
      
      const oldVisibleSegments = Array.isArray(item.visibleSegments) ? item.visibleSegments : null;
      
      item.segments.forEach((seg, idx) => {
        const wasVisible = !oldVisibleSegments || oldVisibleSegments.includes(idx);
        const MAX_LEN = item.type === 'bible' ? 220 : 999999;
        
        if (seg.length > MAX_LEN) {
            console.log('SPLITTING!', seg.length, MAX_LEN);
          let remaining = seg;
          let partIndex = 0;
          
          const originalLabel = item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? 'Ayat '+(idx+1) : 'Bait '+(idx+1));
          
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
          const newIdx = newSegments.length;
          newSegments.push(seg);
          if (wasVisible) {
            newVisibleSegments.push(newIdx);
          }
          newLabels.push(item.segmentLabels ? item.segmentLabels[idx] : (item.type === 'bible' ? 'Ayat '+(idx+1) : 'Bait '+(idx+1)));
        }
      });
      
      return { ...item, segments: newSegments, segmentLabels: newLabels };
    }
    return item;
  });
};

const testItem = {
    type: 'song',
    segments: ['God Himself is with us; Let us all adore Him,\nAnd with awe appear before Him.\nGod is here within us; Soul, in silence fear Him,\nHumbly, fervently draw near Him.\nNow His own who have known God, in worship lowly,\nYield their spirits wholly.']
};

console.log(splitLongSegments([testItem])[0].segmentLabels);
