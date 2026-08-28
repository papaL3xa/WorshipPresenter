import { get, set, keys, del } from 'idb-keyval';
import { callApi } from '../api';
import Papa from 'papaparse';
export interface DatabaseVersion {
  id: string; // e.g. "song_LSEB", "bible_TB"
  name: string; // e.g. "Lagu Sion / Buku Ende", "Terjemahan Baru (TB)"
  type: 'song' | 'bible';
  isDefault?: boolean;
}

// Format of Song Object
export interface SongData {
  id: string;
  title: string;
  author: string;
  category: string;
  key?: string;
  beat?: string;
  segmentOrder: number[];
  segments: string[];
  segmentLabels?: string[];
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// ------------------------------------------------------------------
// INIT DATABASES FROM FOLDER
// ------------------------------------------------------------------
export const initDefaultDatabases = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  if (w.electronAPI) {
    console.log("Memindai folder Databases untuk file TSV...");
    try {
      const res = await w.electronAPI.callApi('read-database-folder');
      if (res.success && res.files && res.files.length > 0) {
        for (const file of res.files) {
          const contentRes = await w.electronAPI.callApi('read-tsv-file', {}, { filename: file });
          if (contentRes.success) {
            const isBible = file.toLowerCase().includes('bible') || file.toLowerCase().includes('alkitab');
            const idSuffix = file.replace(/\.tsv$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
            const type = isBible ? 'bible' : 'song';
            const info: DatabaseVersion = {
              id: `${type}_${idSuffix}`,
              name: file.replace(/\.tsv$/i, ''),
              type,
              isDefault: false
            };
            try {
              await addCustomDatabase(info, contentRes.content);
              console.log(`Berhasil memuat TSV: ${file}`);
            } catch (e) {
              console.error(`Gagal memparsing file TSV: ${file}`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Gagal membaca folder Databases", e);
    }
  }

  // Always load default DBs if they don't exist in IndexedDB yet
  const existingKeys = await keys();
  const dbKeys = existingKeys.filter(k => typeof k === 'string' && k.startsWith('dbinfo_')) as string[];
  const dataKeys = existingKeys.filter(k => typeof k === 'string' && k.startsWith('dbdata_')) as string[];

  const currentDbVersion = '1.0.9'; // Increment version
  const savedDbVersion = localStorage.getItem('worship_db_version');

  const isOutdated = savedDbVersion !== currentDbVersion;

  if (isOutdated || !dbKeys.includes('dbinfo_song_LSEB') || !dataKeys.includes('dbdata_song_LSEB')) {
    console.log("Initializing LSEB song database dari data internal...");
    await loadDefaultSongDatabase();
  }
  
  if (isOutdated || !dbKeys.includes('dbinfo_bible_TB') || !dataKeys.includes('dbdata_bible_TB')) {
    console.log("Initializing default bible database (TB)...");
    await loadDefaultBibleDatabase('TB', 'Terjemahan Baru (TB)', 'data/BibleVerses_TB.tsv');
  }

  if (isOutdated) {
    localStorage.setItem('worship_db_version', currentDbVersion);
  }
};

const parseTsv = (tsvContent: string, isBible: boolean = false) => {
  // Pre-process: if user had \n literally typed as strings in TSV, we replace them with actual newlines temporarily
  // but PapaParse natively handles actual newlines inside quotes!
  const result = Papa.parse(tsvContent.trim(), {
    delimiter: '\t',
    header: true,
    skipEmptyLines: true,
    quoteChar: isBible ? '' : '"',
  });
  // PapaParse returns an array of objects
  return result.data as any[];
};

export const exportDatabaseToTsv = async (id: string) => {
  const info = await get(`dbinfo_${id}`) as DatabaseVersion;
  const data = await get(`dbdata_${id}`);
  if (!info || !data || !Array.isArray(data)) throw new Error("Database tidak valid");

  let tsvString = '';

  if (info.type === 'bible') {
    tsvString = Papa.unparse(data, { delimiter: '\t', quotes: true });
  } else {
    // For songs, flatten segments into segment1, segment2, etc.
    const flatData = data.map((song: SongData) => {
      const row: any = {
        songId: song.id,
        title: song.title,
        author: song.author,
        category: song.category,
        key: song.key || '',
        beat: song.beat || ''
      };
      song.segments.forEach((seg, idx) => {
        // Here we ensure real newlines are kept. PapaParse will automatically quote them.
        row[`segment${idx + 1}`] = seg.replace(/\\n/g, '\n');
      });
      return row;
    });
    tsvString = Papa.unparse(flatData, { delimiter: '\t', quotes: true });
  }

  return { name: info.name, type: info.type, content: tsvString };
};
const fetchText = async (relativePath: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.electronAPI) {
    const res = await w.electronAPI.callApi('read-local-file', {}, { path: relativePath });
    if (res.success) return res.data;
    throw new Error(res.message);
  }
  const baseUrl = import.meta.env.BASE_URL;
  const response = await fetch(`${baseUrl}${relativePath}`);
  return await response.text();
};

const loadDefaultSongDatabase = async () => {
  try {
    const [songsText, segmentsText] = await Promise.all([
      fetchText('data/Songs.tsv'),
      fetchText('data/SongSegments.tsv')
    ]);
    
    
    const parsedSongs = parseTsv(songsText);
    const parsedSegments = parseTsv(segmentsText);
    
    // Group segments by songId
    const segmentMap: Record<string, string[]> = {};
    const labelMap: Record<string, string[]> = {};
    parsedSegments.forEach((seg: any) => {
      if (!segmentMap[seg.songId]) {
        segmentMap[seg.songId] = [];
        labelMap[seg.songId] = [];
      }
      if (typeof seg.text === 'string') {
        segmentMap[seg.songId].push(seg.text.replace(/\\n/g, '\n'));
      } else {
        segmentMap[seg.songId].push(seg.text);
      }
      labelMap[seg.songId].push(seg.label || `Slide ${segmentMap[seg.songId].length}`);
    });
    
    const finalSongs: SongData[] = parsedSongs.map((s: any) => ({
      id: s.songId,
      title: s.title,
      author: s.author || '',
      category: s.category || '',
      key: s.key || s.nada_dasar || s.nadaDasar || '',
      beat: s.beat || s.ketukan || '',
      segmentOrder: s.segmentOrder ? JSON.parse(s.segmentOrder) : [],
      segments: segmentMap[s.songId] || [],
      segmentLabels: labelMap[s.songId] || []
    }));
    
    await set('dbinfo_song_LSEB', { id: 'song_LSEB', name: 'Lagu Sion / Buku Ende', type: 'song', isDefault: true } as DatabaseVersion);
    await set('dbdata_song_LSEB', finalSongs);
  } catch (error) {
    console.error("Failed to load default song db", error);
  }
};

const loadDefaultFlatSongDatabase = async (idSuffix: string, name: string, fileRelativePath: string) => {
  try {
    const text = await fetchText(fileRelativePath);
    const info: DatabaseVersion = { id: idSuffix, name, type: 'song', isDefault: true };
    await addCustomDatabase(info, text);
  } catch (error) {
    console.error(`Failed to load flat song db ${idSuffix}`, error);
  }
};

const loadDefaultBibleDatabase = async (idSuffix: string, name: string, fileRelativePath: string) => {
  try {
    const text = await fetchText(fileRelativePath);
    const parsedBible = parseTsv(text, true);
    
    const finalVerses: BibleVerse[] = parsedBible.map((v: any) => ({
      book: v.book,
      chapter: parseInt(v.chapter, 10),
      verse: parseInt(v.verse, 10),
      text: v.text
    }));
    
    await set(`dbinfo_bible_${idSuffix}`, { id: `bible_${idSuffix}`, name: name, type: 'bible', isDefault: true } as DatabaseVersion);
    await set(`dbdata_bible_${idSuffix}`, finalVerses);
  } catch (error) {
    console.error(`Failed to load default bible db ${idSuffix}`, error);
  }
};

// ------------------------------------------------------------------
// UPLOAD CUSTOM TSV DATABASES
// ------------------------------------------------------------------
export const addCustomDatabase = async (info: DatabaseVersion, tsvContent: string) => {
  const parsed = parseTsv(tsvContent, info.type === 'bible');
  // Basic validation
  if (info.type === 'bible' && (!parsed[0].book || !parsed[0].text)) {
    throw new Error("Format TSV Alkitab salah. Harus ada kolom book, chapter, verse, text.");
  }
  
  await set(`dbinfo_${info.id}`, info);
  
  if (info.type === 'bible') {
    const finalVerses: BibleVerse[] = parsed.map((v: any) => ({
      book: v.book,
      chapter: parseInt(v.chapter, 10) || 1,
      verse: parseInt(v.verse, 10) || 1,
      text: v.text
    }));
    await set(`dbdata_${info.id}`, finalVerses);
  } else {
    // For custom songs, we assume a simple flat TSV structure for user upload: 
    // songId, title, author, segment1, segment2, segment3...
    // OR raw structure: id, title, author, lyrics
    const finalSongs: SongData[] = parsed.map((s: any) => {
      const segs = [];
      
      // Auto-detect format
      if (s.segment1 !== undefined) {
        let i = 1;
        while (s[`segment${i}`] !== undefined) {
          const segVal = s[`segment${i}`];
          if (segVal && segVal.trim() !== '') {
            segs.push(segVal);
          }
          i++;
        }
      } else if (s.lyrics !== undefined) {
        // Raw TSV scraper format
        const parts = s.lyrics.split(/\n\n/);
        parts.forEach((p: string) => {
          if (p.trim()) segs.push(p.trim());
        });
      }

      // Detect ID key, in case of BOM or 'id' vs 'songId'
      const idKey = Object.keys(s).find(k => k.trim().replace(/^\\uFEFF/, '') === 'songId') || 'songId';
      const fallbackIdKey = Object.keys(s).find(k => k.trim().replace(/^\\uFEFF/, '') === 'id') || 'id';

      return {
        id: s[idKey] || s[fallbackIdKey] || `CUSTOM_${Math.random().toString(36).substring(7)}`,
        title: s.title || 'Untitled',
        author: s.author || '',
        category: s.category || 'Custom',
        key: s.key || s.nada_dasar || s.nadaDasar || '',
        beat: s.beat || s.ketukan || '',
        segmentOrder: Array.from({length: segs.length}, (_, idx) => idx),
        segments: segs
      };
    });
    await set(`dbdata_${info.id}`, finalSongs);
  }
};

export const deleteDatabase = async (id: string) => {
  await del(`dbinfo_${id}`);
  await del(`dbdata_${id}`);
};

export const getDatabaseList = async (): Promise<DatabaseVersion[]> => {
  const existingKeys = await keys();
  const infoKeys = existingKeys.filter(k => typeof k === 'string' && k.startsWith('dbinfo_')) as string[];
  const list = [];
  for (const k of infoKeys) {
    const info = await get(k);
    if (info) list.push(info);
  }
  return list;
};

// ------------------------------------------------------------------
// SYNC GOOGLE APPS SCRIPT CUSTOM SONGS
// ------------------------------------------------------------------
export const syncCustomSongs = async () => {
  try {
    // Call GAS to get all songs. 
    // Since we don't have a "modified" column, we just fetch ALL songs 
    // from GAS and overwrite a special "dbdata_song_GAS_SYNC" in IndexedDB
    // Or we merge it into "song_LSEB".
    // It's better to store them in a separate DB key so it's clean.
    const res = await callApi('getCustomSongs'); 
    if (res && res.data) {
       await set('dbdata_song_GAS_SYNC', res.data);
    }
  } catch (error) {
    console.error("Failed to sync custom songs", error);
  }
};

// ------------------------------------------------------------------
// SEARCH & RETRIEVE
// ------------------------------------------------------------------
export const searchLocalSongs = async (query: string, versionId: string, category: string = 'Semua'): Promise<any[]> => {
  let baseSongs: SongData[] = [];
  
  baseSongs = (await get(`dbdata_${versionId}`)) || [];
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
};

export const searchLocalBible = async (query: string, versionId: string): Promise<any[]> => {
  if (!query) return [];
  const q = query.toLowerCase();
  
  let structuredQuery: any = null;
  const rangeMatch = q.match(/^([1-3]?[a-z\s]+?)\s*(\d+):(\d+)\s*-\s*(\d+)$/i);
  const refMatch = q.match(/^([1-3]?[a-z\s]+?)\s*(\d+):(\d+)$/i);
  const chapMatch = q.match(/^([1-3]?[a-z\s]+?)\s*(\d+)$/i);

  if (rangeMatch) structuredQuery = { type: 'range', book: rangeMatch[1].trim(), chapter: parseInt(rangeMatch[2], 10), startVerse: parseInt(rangeMatch[3], 10), endVerse: parseInt(rangeMatch[4], 10) };
  else if (refMatch) structuredQuery = { type: 'verse', book: refMatch[1].trim(), chapter: parseInt(refMatch[2], 10), verse: parseInt(refMatch[3], 10) };
  else if (chapMatch) structuredQuery = { type: 'chapter', book: chapMatch[1].trim(), chapter: parseInt(chapMatch[2], 10) };
  else structuredQuery = { type: 'free', query: q };

  const verses: BibleVerse[] = (await get(`dbdata_${versionId}`)) || [];
  
  if (structuredQuery.type === 'range') {
    const foundVerses = verses.filter(v => v.book.toLowerCase().includes(structuredQuery.book) && v.chapter === structuredQuery.chapter && v.verse >= structuredQuery.startVerse && v.verse <= structuredQuery.endVerse);
    if (foundVerses.length > 0) {
      return [{
        isRange: true,
        id: `r_${Date.now()}`,
        title: `${foundVerses[0].book} ${structuredQuery.chapter}:${structuredQuery.startVerse}-${structuredQuery.endVerse}`,
        segments: foundVerses.map(v => v.text),
        segmentLabels: foundVerses.map(v => `Ayat ${v.verse}`),
        book: foundVerses[0].book,
        chapter: structuredQuery.chapter,
        startVerse: structuredQuery.startVerse,
        endVerse: structuredQuery.endVerse
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
};

export const getAllLocalSongTitles = async (versionId: string) => {
  const songs = await searchLocalSongs('', versionId);
  return songs.map((s:any) => ({ id: s.id, title: s.title, category: s.category, author: s.author, key: s.key, beat: s.beat }));
};

export const getLocalSongCategories = async (versionId: string): Promise<string[]> => {
  const baseSongs: SongData[] = (await get(`dbdata_${versionId}`)) || [];
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
};

export const getCrossLanguageVerses = async (
  results: any[], 
  versionId1: string, 
  versionId2: string
): Promise<any[]> => {
  const verses1: BibleVerse[] = (await get(`dbdata_${versionId1}`)) || [];
  const verses2: BibleVerse[] = (await get(`dbdata_${versionId2}`)) || [];
  
  const books1 = Array.from(new Set(verses1.map(v => v.book)));
  const books2 = Array.from(new Set(verses2.map(v => v.book)));

  return results.map(item => {
    if (item.isRange) {
      const bookIdx = books1.indexOf(item.book);
      const book2Name = books2[bookIdx];
      if (!book2Name) return null;
      const rangeVerses = verses2.filter(v => v.book === book2Name && v.chapter === item.chapter && v.verse >= item.startVerse && v.verse <= item.endVerse);
      return { isRange: true, segments: rangeVerses.map(v => v.text) };
    } else {
      const bookIdx = books1.indexOf(item.book);
      const book2Name = books2[bookIdx];
      if (!book2Name) return null;
      const verse = verses2.find(v => v.book === book2Name && v.chapter === item.chapter && v.verse === item.verse);
      return verse ? { text: verse.text } : null;
    }
  });
};
// ------------------------------------------------------------------
// BIBLE METADATA HELPERS
// ------------------------------------------------------------------
export const getBibleBooksList = async (versionId: string): Promise<string[]> => {
  const verses: BibleVerse[] = (await get(`dbdata_${versionId}`)) || [];
  const booksMap = new Set<string>();
  for (const v of verses) {
    if (v.book) booksMap.add(v.book);
  }
  return Array.from(booksMap);
};

export const getBibleBookMetadata = async (versionId: string, bookName: string): Promise<number> => {
  const verses: BibleVerse[] = (await get(`dbdata_${versionId}`)) || [];
  let maxChapter = 0;
  const b = bookName.toLowerCase();
  for (const v of verses) {
    if (v.book.toLowerCase() === b) {
      if (v.chapter > maxChapter) maxChapter = v.chapter;
    }
  }
  return maxChapter;
};

export const getBibleChapterMetadata = async (versionId: string, bookName: string, chapter: number): Promise<number> => {
  const verses: BibleVerse[] = (await get(`dbdata_${versionId}`)) || [];
  let maxVerse = 0;
  const b = bookName.toLowerCase();
  for (const v of verses) {
    if (v.book.toLowerCase() === b && v.chapter === chapter) {
      if (v.verse > maxVerse) maxVerse = v.verse;
    }
  }
  return maxVerse;
};
