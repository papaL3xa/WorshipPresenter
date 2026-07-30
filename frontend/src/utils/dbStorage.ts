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
  
  if (!dbKeys.includes('dbinfo_song_LSEB')) {
    console.log("Initializing default song database...");
    await loadDefaultSongDatabase();
  }
  
  if (!dbKeys.includes('dbinfo_bible_TB')) {
    console.log("Initializing default bible database...");
    await loadDefaultBibleDatabase();
  }
};

const parseTsv = (tsvContent: string) => {
  const lines = tsvContent.split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split('\t');
    const obj: any = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    results.push(obj);
  }
  return results;
};

const loadDefaultSongDatabase = async () => {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const [songsRes, segmentsRes] = await Promise.all([
      fetch(`${baseUrl}data/Songs.tsv`),
      fetch(`${baseUrl}data/SongSegments.tsv`)
    ]);
    const songsText = await songsRes.text();
    const segmentsText = await segmentsRes.text();
    
    const parsedSongs = parseTsv(songsText);
    const parsedSegments = parseTsv(segmentsText);
    
    // Group segments by songId
    const segmentMap: Record<string, string[]> = {};
    parsedSegments.forEach((seg: any) => {
      if (!segmentMap[seg.songId]) segmentMap[seg.songId] = [];
      segmentMap[seg.songId].push(seg.text);
    });
    
    const finalSongs: SongData[] = parsedSongs.map((s: any) => ({
      id: s.songId,
      title: s.title,
      author: s.author || '',
      category: s.category || '',
      segmentOrder: s.segmentOrder ? JSON.parse(s.segmentOrder) : [],
      segments: segmentMap[s.songId] || []
    }));
    
    await set('dbinfo_song_LSEB', { id: 'song_LSEB', name: 'Lagu Sion / Buku Ende', type: 'song', isDefault: true } as DatabaseVersion);
    await set('dbdata_song_LSEB', finalSongs);
  } catch (error) {
    console.error("Failed to load default song db", error);
  }
};

const loadDefaultBibleDatabase = async () => {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const res = await fetch(`${baseUrl}data/BibleVerses.tsv`);
    const text = await res.text();
    
    const parsed = parseTsv(text);
    const finalVerses: BibleVerse[] = parsed.map((v: any) => ({
      book: v.book,
      chapter: parseInt(v.chapter, 10),
      verse: parseInt(v.verse, 10),
      text: v.text
    }));
    
    await set('dbinfo_bible_TB', { id: 'bible_TB', name: 'Terjemahan Baru (TB)', type: 'bible', isDefault: true } as DatabaseVersion);
    await set('dbdata_bible_TB', finalVerses);
  } catch (error) {
    console.error("Failed to load default bible db", error);
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
    gasSongs = (await get('dbdata_song_GAS_SYNC')) || [];
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
  
  // Free text search
  return verses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 100);
};

export const getAllLocalSongTitles = async (versionId: string) => {
  const songs = await searchLocalSongs('', versionId);
  return songs.map(s => ({ id: s.id, title: s.title }));
};
