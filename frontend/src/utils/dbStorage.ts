import { get, set, keys, del } from 'idb-keyval';
import { callApi } from '../api';

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
// INIT DEFAULT DATABASES
// ------------------------------------------------------------------
export const initDefaultDatabases = async () => {
  const existingKeys = await keys();
  const dbKeys = existingKeys.filter(k => typeof k === 'string' && k.startsWith('dbinfo_')) as string[];
  const dataKeys = existingKeys.filter(k => typeof k === 'string' && k.startsWith('dbdata_')) as string[];

  const currentDbVersion = '1.4'; // Update this when default TSVs change
  const savedDbVersion = localStorage.getItem('worship_db_version');

  const isOutdated = savedDbVersion !== currentDbVersion;

  // Cek info DAN data, jika salah satu hilang atau versi usang → re-init
  if (isOutdated || !dbKeys.includes('dbinfo_song_LSEB') || !dataKeys.includes('dbdata_song_LSEB')) {
    console.log("Initializing/Updating default song database...");
    await loadDefaultSongDatabase();
  } else {
    // Auto-repair if segmentLabels are missing
    const songData = await get('dbdata_song_LSEB');
    if (songData && Array.isArray(songData) && songData.length > 0) {
      if (!songData[0].segmentLabels) {
        console.log("Song database missing labels, auto-repairing...");
        await loadDefaultSongDatabase();
      }
    }
  }
  
  if (isOutdated || !dbKeys.includes('dbinfo_bible_TB') || !dataKeys.includes('dbdata_bible_TB')) {
    console.log("Initializing default bible database (TB)...");
    await loadDefaultBibleDatabase('TB', 'Terjemahan Baru (TB)', 'data/BibleVerses_TB.tsv');
  }

  if (isOutdated || !dbKeys.includes('dbinfo_bible_AYT') || !dataKeys.includes('dbdata_bible_AYT')) {
    console.log("Initializing AYT bible database...");
    await loadDefaultBibleDatabase('AYT', 'Alkitab Yang Terbuka (AYT)', 'data/BibleVerses_AYT.tsv');
  }

  // Init KJV
  if (isOutdated || !dbKeys.includes('dbinfo_bible_KJV') || !dataKeys.includes('dbdata_bible_KJV')) {
    console.log("Initializing KJV bible database...");
    await loadDefaultBibleDatabase('KJV', 'King James Version (KJV)', 'data/BibleVerses_KJV.tsv');
  }

  if (isOutdated) {
    localStorage.setItem('worship_db_version', currentDbVersion);
  }
};

import Papa from 'papaparse';

const parseTsv = (tsvContent: string) => {
  // Pre-process: if user had \n literally typed as strings in TSV, we replace them with actual newlines temporarily
  // but PapaParse natively handles actual newlines inside quotes!
  const result = Papa.parse(tsvContent.trim(), {
    delimiter: '\t',
    header: true,
    skipEmptyLines: true,
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
        category: song.category
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

const loadDefaultBibleDatabase = async (idSuffix: string, name: string, fileRelativePath: string) => {
  try {
    const text = await fetchText(fileRelativePath);
    const parsedBible = parseTsv(text);
    
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
  const parsed = parseTsv(tsvContent);
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
    const finalSongs: SongData[] = parsed.map((s: any) => {
      const segs = [];
      let i = 1;
      while (s[`segment${i}`] !== undefined) {
        segs.push(s[`segment${i}`]);
        i++;
      }
      return {
        id: s.songId || `CUSTOM_${Math.random().toString(36).substring(7)}`,
        title: s.title || 'Untitled',
        author: s.author || '',
        category: s.category || 'Custom',
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
export const searchLocalSongs = async (query: string, versionId: string): Promise<any[]> => {
  // 1. Get base version
  const baseSongs: SongData[] = (await get(`dbdata_${versionId}`)) || [];
  
  // 2. Get synced GAS songs (only apply to default LSEB to mix them)
  let gasSongs: SongData[] = [];
  if (versionId === 'song_LSEB') {
    const rawGas = await get('dbdata_song_GAS_SYNC');
    gasSongs = Array.isArray(rawGas) ? rawGas : [];
  }
  
  // Merge (GAS overrides Base if same ID)
  const mergedMap = new Map<string, SongData>();
  baseSongs.forEach(s => mergedMap.set(s.id, s));
  gasSongs.forEach(s => mergedMap.set(s.id, s));
  
  const allSongs = Array.from(mergedMap.values());
  
  if (!query) {
    return allSongs; // Return all for the Grid/List view
  }
  
  const q = query.toLowerCase();
  return allSongs.filter(s => 
    s.id.toLowerCase().includes(q) || 
    s.title.toLowerCase().includes(q) ||
    s.segments.some(seg => seg.toLowerCase().includes(q))
  );
};

export const searchLocalBible = async (query: string, versionId: string): Promise<any[]> => {
  const verses: BibleVerse[] = (await get(`dbdata_${versionId}`)) || [];
  
  if (!query) return [];
  
  const q = query.toLowerCase();
  
  // Support range reference: "Kejadian 1:1-9"
  const rangeMatch = q.match(/^([1-3]?[a-z\s]+?)\s*(\d+):(\d+)\s*-\s*(\d+)$/i);
  if (rangeMatch) {
    let bookQuery = rangeMatch[1].trim();
    const chapQuery = parseInt(rangeMatch[2], 10);
    const startVerse = parseInt(rangeMatch[3], 10);
    const endVerse = parseInt(rangeMatch[4], 10);
    
    const foundVerses = verses.filter(v => 
      v.book.toLowerCase().includes(bookQuery) && 
      v.chapter === chapQuery && 
      v.verse >= startVerse &&
      v.verse <= endVerse
    );

    if (foundVerses.length > 0) {
      return [{
        isRange: true,
        id: `r_${Date.now()}`,
        title: `${foundVerses[0].book} ${chapQuery}:${startVerse}-${endVerse}`,
        segments: foundVerses.map(v => v.text)
      }];
    }
    return [];
  }

  // Support exact reference: "Kejadian 1:1"
  const refMatch = q.match(/^([1-3]?[a-z\s]+?)\s*(\d+):(\d+)$/i);
  if (refMatch) {
    let bookQuery = refMatch[1].trim();
    const chapQuery = parseInt(refMatch[2], 10);
    const verseQuery = parseInt(refMatch[3], 10);
    
    return verses.filter(v => 
      v.book.toLowerCase().includes(bookQuery) && 
      v.chapter === chapQuery && 
      v.verse === verseQuery
    );
  }

  // Support chapter reference: "Kejadian 1"
  const chapMatch = q.match(/^([1-3]?[a-z\s]+?)\s*(\d+)$/i);
  if (chapMatch) {
    let bookQuery = chapMatch[1].trim();
    const chapQuery = parseInt(chapMatch[2], 10);
    return verses.filter(v => 
      v.book.toLowerCase().includes(bookQuery) && 
      v.chapter === chapQuery
    );
  }
  
  // Support exact book reference: "Kejadian"
  const cleanQ = q.trim();
  const matchingVerses = verses.filter(v => v.book.toLowerCase() === cleanQ);
  if (matchingVerses.length > 0) {
    return matchingVerses.slice(0, 100);
  }
  
  // Free text search
  return verses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 100);
};

export const getAllLocalSongTitles = async (versionId: string) => {
  const songs = await searchLocalSongs('', versionId);
  return songs.map(s => ({ id: s.id, title: s.title }));
};
