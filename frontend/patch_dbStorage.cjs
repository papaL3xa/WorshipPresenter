const fs = require('fs');
const file = '/home/sagala/pisgahbisdac/PB/frontend/src/utils/dbStorage.ts';
let code = fs.readFileSync(file, 'utf8');

// Patch loadDefaultSongDatabase
code = code.replace(
  /await set\('dbdata_song_LSEB', finalSongs\);/,
  `await set('dbdata_song_LSEB', finalSongs);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.callApi('init-sqlite', {}, { type: 'song', versionId: 'song_LSEB', data: finalSongs }).catch(console.error);
    }`
);

// Patch loadDefaultBibleDatabase
code = code.replace(
  /await set\(\`dbdata_bible_\$\{idSuffix\}\`, finalVerses\);/,
  `await set(\`dbdata_bible_\${idSuffix}\`, finalVerses);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.callApi('init-sqlite', {}, { type: 'bible', versionId: \`bible_\${idSuffix}\`, data: finalVerses }).catch(console.error);
    }`
);

// Patch addCustomDatabase
code = code.replace(
  /await set\(\`dbdata_\$\{info\.id\}\`, finalVerses\);/,
  `await set(\`dbdata_\${info.id}\`, finalVerses);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.callApi('init-sqlite', {}, { type: 'bible', versionId: info.id, data: finalVerses }).catch(console.error);
    }`
);
code = code.replace(
  /await set\(\`dbdata_\$\{info\.id\}\`, finalSongs\);/,
  `await set(\`dbdata_\${info.id}\`, finalSongs);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.callApi('init-sqlite', {}, { type: 'song', versionId: info.id, data: finalSongs }).catch(console.error);
    }`
);

// Replace searchLocalSongs
const newSearchLocalSongs = `export const searchLocalSongs = async (query: string, versionId: string, category: string = 'Semua'): Promise<any[]> => {
  let baseSongs: SongData[] = [];
  
  if ((window as any).electronAPI) {
    const res = await (window as any).electronAPI.callApi('search-sqlite-song', {}, { query, versionId, category });
    if (res && res.success) {
       baseSongs = res.data;
    }
  } else {
    baseSongs = (await get(\`dbdata_\${versionId}\`)) || [];
    let allBase = baseSongs.filter((s:any) => !s.deleted);
    if (category && category !== 'Semua') {
      allBase = allBase.filter(s => s.category === category);
    }
    if (query) {
      const q = query.toLowerCase();
      allBase = allBase.filter(s => 
         s.id.toLowerCase().includes(q) || 
         s.title.toLowerCase().includes(q) ||
         s.segments.some((seg:string) => seg.toLowerCase().includes(q))
      );
    }
    baseSongs = allBase;
  }
  
  const rawGas = await get('dbdata_song_GAS_SYNC');
  const gasSongs: SongData[] = Array.isArray(rawGas) ? rawGas : [];
  
  let filteredGas = gasSongs.filter((s:any) => !s.deleted);
  if (category && category !== 'Semua') {
     filteredGas = filteredGas.filter(s => s.category === category);
  }
  if (query) {
     const q = query.toLowerCase();
     filteredGas = filteredGas.filter(s => 
        s.id.toLowerCase().includes(q) || 
        s.title.toLowerCase().includes(q) ||
        s.segments.some((seg:string) => seg.toLowerCase().includes(q))
     );
  }
  
  const mergedMap = new Map<string, SongData>();
  baseSongs.forEach(s => mergedMap.set(s.id, s));
  filteredGas.forEach(s => mergedMap.set(s.id, s));
  
  const allSongs = Array.from(mergedMap.values());
  if (query.match(/^[a-z0-9_]+$/i)) {
     const exactMatch = allSongs.find(s => s.id === query);
     if (exactMatch) return [exactMatch];
  }
  return allSongs;
};`;
code = code.replace(/export const searchLocalSongs = async \(query: string, versionId: string, category: string = 'Semua'\): Promise<any\[\]> => \{[\s\S]*?^\};/m, newSearchLocalSongs);

// Replace searchLocalBible
const newSearchLocalBible = `export const searchLocalBible = async (query: string, versionId: string): Promise<any[]> => {
  if (!query) return [];
  const q = query.toLowerCase();
  
  let structuredQuery: any = null;
  const rangeMatch = q.match(/^([1-3]?[a-z\\s]+?)\\s*(\\d+):(\\d+)\\s*-\\s*(\\d+)$/i);
  const refMatch = q.match(/^([1-3]?[a-z\\s]+?)\\s*(\\d+):(\\d+)$/i);
  const chapMatch = q.match(/^([1-3]?[a-z\\s]+?)\\s*(\\d+)$/i);

  if (rangeMatch) structuredQuery = { type: 'range', book: rangeMatch[1].trim(), chapter: parseInt(rangeMatch[2], 10), startVerse: parseInt(rangeMatch[3], 10), endVerse: parseInt(rangeMatch[4], 10) };
  else if (refMatch) structuredQuery = { type: 'verse', book: refMatch[1].trim(), chapter: parseInt(refMatch[2], 10), verse: parseInt(refMatch[3], 10) };
  else if (chapMatch) structuredQuery = { type: 'chapter', book: chapMatch[1].trim(), chapter: parseInt(chapMatch[2], 10) };
  else structuredQuery = { type: 'free', query: q };

  if ((window as any).electronAPI) {
     const res = await (window as any).electronAPI.callApi('search-sqlite-bible', {}, { structuredQuery, versionId });
     if (res && res.success) {
        if (structuredQuery.type === 'range' && res.data.length > 0) {
           return [{
              isRange: true,
              id: \`r_\${Date.now()}\`,
              title: \`\${res.data[0].book} \${structuredQuery.chapter}:\${structuredQuery.startVerse}-\${structuredQuery.endVerse}\`,
              segments: res.data.map((v:any) => v.text),
              segmentLabels: res.data.map((v:any) => \`Ayat \${v.verse}\`)
           }];
        }
        return res.data;
     }
  }

  const verses: BibleVerse[] = (await get(\`dbdata_\${versionId}\`)) || [];
  
  if (structuredQuery.type === 'range') {
    const foundVerses = verses.filter(v => v.book.toLowerCase().includes(structuredQuery.book) && v.chapter === structuredQuery.chapter && v.verse >= structuredQuery.startVerse && v.verse <= structuredQuery.endVerse);
    if (foundVerses.length > 0) {
      return [{
        isRange: true,
        id: \`r_\${Date.now()}\`,
        title: \`\${foundVerses[0].book} \${structuredQuery.chapter}:\${structuredQuery.startVerse}-\${structuredQuery.endVerse}\`,
        segments: foundVerses.map(v => v.text),
        segmentLabels: foundVerses.map(v => \`Ayat \${v.verse}\`)
      }];
    }
    return [];
  } else if (structuredQuery.type === 'verse') {
    return verses.filter(v => v.book.toLowerCase().includes(structuredQuery.book) && v.chapter === structuredQuery.chapter && v.verse === structuredQuery.verse);
  } else if (structuredQuery.type === 'chapter') {
    return verses.filter(v => v.book.toLowerCase().includes(structuredQuery.book) && v.chapter === structuredQuery.chapter);
  }
  
  const cleanQ = q.trim();
  const matchingVerses = verses.filter(v => v.book.toLowerCase() === cleanQ);
  if (matchingVerses.length > 0) return matchingVerses.slice(0, 100);
  
  return verses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 100);
};`;
code = code.replace(/export const searchLocalBible = async \(query: string, versionId: string\): Promise<any\[\]> => \{[\s\S]*?^\};/m, newSearchLocalBible);

// Replace getBibleBooksList
code = code.replace(/export const getBibleBooksList = async \(versionId: string\): Promise<string\[\]> => \{[\s\S]*?^\};/m, `export const getBibleBooksList = async (versionId: string): Promise<string[]> => {
  if ((window as any).electronAPI) {
    const res = await (window as any).electronAPI.callApi('get-sqlite-bible-books', {}, { versionId });
    if (res && res.success) return res.data;
  }
  const verses: BibleVerse[] = (await get(\`dbdata_\${versionId}\`)) || [];
  const booksMap = new Set<string>();
  for (const v of verses) {
    if (v.book) booksMap.add(v.book);
  }
  return Array.from(booksMap);
};`);

// Replace getBibleBookMetadata
code = code.replace(/export const getBibleBookMetadata = async \(versionId: string, bookName: string\): Promise<number> => \{[\s\S]*?^\};/m, `export const getBibleBookMetadata = async (versionId: string, bookName: string): Promise<number> => {
  if ((window as any).electronAPI) {
    const res = await (window as any).electronAPI.callApi('get-sqlite-bible-book-meta', {}, { versionId, book: bookName });
    if (res && res.success) return res.data;
  }
  const verses: BibleVerse[] = (await get(\`dbdata_\${versionId}\`)) || [];
  let maxChapter = 0;
  const b = bookName.toLowerCase();
  for (const v of verses) {
    if (v.book.toLowerCase() === b) {
      if (v.chapter > maxChapter) maxChapter = v.chapter;
    }
  }
  return maxChapter;
};`);

// Replace getBibleChapterMetadata
code = code.replace(/export const getBibleChapterMetadata = async \(versionId: string, bookName: string, chapter: number\): Promise<number> => \{[\s\S]*?^\};/m, `export const getBibleChapterMetadata = async (versionId: string, bookName: string, chapter: number): Promise<number> => {
  if ((window as any).electronAPI) {
    const res = await (window as any).electronAPI.callApi('get-sqlite-bible-chapter-meta', {}, { versionId, book: bookName, chapter });
    if (res && res.success) return res.data;
  }
  const verses: BibleVerse[] = (await get(\`dbdata_\${versionId}\`)) || [];
  let maxVerse = 0;
  const b = bookName.toLowerCase();
  for (const v of verses) {
    if (v.book.toLowerCase() === b && v.chapter === chapter) {
      if (v.verse > maxVerse) maxVerse = v.verse;
    }
  }
  return maxVerse;
};`);

// Replace getAllLocalSongTitles
code = code.replace(/export const getAllLocalSongTitles = async \(versionId: string\) => \{[\s\S]*?^\};/m, `export const getAllLocalSongTitles = async (versionId: string) => {
  if ((window as any).electronAPI) {
    const res = await (window as any).electronAPI.callApi('get-sqlite-song-titles', {}, { versionId });
    if (res && res.success) return res.data;
  }
  const songs = await searchLocalSongs('', versionId);
  return songs.map((s:any) => ({ id: s.id, title: s.title, category: s.category, author: s.author, key: s.key, beat: s.beat }));
};`);

// Replace getLocalSongCategories
code = code.replace(/export const getLocalSongCategories = async \(versionId: string\): Promise<string\[\]> => \{[\s\S]*?^\};/m, `export const getLocalSongCategories = async (versionId: string): Promise<string[]> => {
  if ((window as any).electronAPI) {
    const res = await (window as any).electronAPI.callApi('get-sqlite-song-categories', {}, { versionId });
    if (res && res.success) return res.data;
  }
  const baseSongs: SongData[] = (await get(\`dbdata_\${versionId}\`)) || [];
  const rawGas = await get('dbdata_song_GAS_SYNC');
  const gasSongs: SongData[] = Array.isArray(rawGas) ? rawGas : [];
  
  const mergedMap = new Map<string, SongData>();
  baseSongs.forEach(s => mergedMap.set(s.id, s));
  gasSongs.forEach(s => mergedMap.set(s.id, s));
  
  const allSongs = Array.from(mergedMap.values());
  const categories = new Set<string>();
  allSongs.forEach(s => {
    if (s.category) categories.add(s.category);
  });
  return Array.from(categories).sort();
};`);

fs.writeFileSync(file, code);
