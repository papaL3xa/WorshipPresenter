import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2, Music, BookOpen, Edit, Save, Trash2, X, ArrowLeft, ArrowRight, Monitor, Star, Copy, Settings, Download, Upload, FileText, FileCode } from 'lucide-react';
import { callApi } from '../api';
import { useBackgrounds } from '../hooks/useBackgrounds';
import { FooterClock } from '../components/FooterClock';
import { ThemeToggle } from '../components/ThemeToggle';

import { useNavigate, useLocation } from 'react-router-dom';
import { useFavorites } from '../hooks/useFavorites';
import { SyncButton } from '../components/SyncButton';
import { initDefaultDatabases, searchLocalSongs, searchLocalBible, getDatabaseList, DatabaseVersion, getAllLocalSongTitles, deleteDatabase, addCustomDatabase, syncCustomSongs, exportDatabaseToTsv, exportDatabaseToJson, getBibleBookMetadata, getBibleChapterMetadata, getBibleBooksList, getLocalSongCategories } from '../utils/dbStorage';
import { calculateOptimalFontSize } from '../utils/fontCalculator';
import { hasChorus, expandSongWithChorus, isChorusAlreadyEmbedded } from '../utils/songHelper';
import { get, set } from 'idb-keyval';
import { globalDisplayWindow, globalIsDisplayOpen, setGlobalDisplayWindow, setGlobalIsDisplayOpen } from '../utils/displayState';

// bibleBooks array removed, fetched dynamically from database instead

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  author?: string;
  category?: string;
  key?: string;
  beat?: string;
  segments: string[];
  segmentLabels?: string[];
  hideHeaderTitle?: boolean;
  headerTitleFontSizeOffset?: number;
  [key: string]: any;
}

const processPreviewText = (raw: string) => {
  if (!raw) return '';
  let t = raw;
  t = t.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]([^\[\n]*)/g, ''); // strip chords

  // Bilingual side-by-side layout
  if (t.includes('\n[kuning]')) {
    const parts = t.split('\n[kuning]');
    if (parts.length === 2 && parts[1].endsWith('[/kuning]')) {
      const left = parts[0].replace(/\n/g, '<br/>');
      const right = parts[1].replace('[/kuning]', '').replace(/\n/g, '<br/>');
      return `<div class="grid grid-cols-2 gap-8 w-full relative"><div class="min-w-0 break-words text-left self-center">${left}</div><div class="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white/30 rounded-full my-2 pointer-events-none"></div><div class="min-w-0 break-words text-right text-yellow-300 self-center">${right}</div></div>`;
    }
  }

  // 2-Kolom Bebas (Pengumuman)
  if (t.includes('\n[kolom2]')) {
    const parts = t.split('\n[kolom2]');
    if (parts.length === 2 && parts[1].endsWith('[/kolom2]')) {
      const left = parts[0].replace(/\n/g, '<br/>');
      const right = parts[1].replace('[/kolom2]', '').replace(/\n/g, '<br/>');
      return `<div class="grid grid-cols-2 gap-8 w-full relative"><div class="min-w-0 break-words text-left self-center">${left}</div><div class="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white/30 rounded-full my-2 pointer-events-none"></div><div class="min-w-0 break-words text-left self-center">${right}</div></div>`;
    }
  }

  t = t.replace(/\n/g, '<br/>');
  t = t.replace(/\[merah\](.*?)\[\/merah\]/gi, '<span class="text-red-500 font-bold">$1</span>');
  t = t.replace(/\[kuning\](.*?)\[\/kuning\]/gi, '<span class="text-yellow-400 font-bold">$1</span>');
  t = t.replace(/\[hijau\](.*?)\[\/hijau\]/gi, '<span class="text-green-400 font-bold">$1</span>');
  t = t.replace(/\[biru\](.*?)\[\/biru\]/gi, '<span class="text-blue-400 font-bold">$1</span>');
  t = t.replace(/\[ungu\](.*?)\[\/ungu\]/gi, '<span class="text-purple-400 font-bold">$1</span>');
  t = t.replace(/\[oranye\](.*?)\[\/oranye\]/gi, '<span class="text-orange-400 font-bold">$1</span>');
  return t;
};

export default function Library() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<'song' | 'bible'>('song');
  const [customBg] = useState(localStorage.getItem('custom_bg') || '');
  const [displayTheme] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('worship_display_theme') || '{}');
    } catch {
      return {};
    }
  });
  const { getBgUrl } = useBackgrounds();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isDeletingSong, setIsDeletingSong] = useState(false);
  const [dragSegmentIdx, setDragSegmentIdx] = useState<number | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const originalSongIdRef = useRef<string | null>(null);
  const [allSongTitles, setAllSongTitles] = useState<{ id: string, title: string }[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [dbList, setDbList] = useState<DatabaseVersion[]>([]);
  const [selectedSongVersion, setSelectedSongVersion] = useState('song_LSEB');
  const [selectedBibleVersion, setSelectedBibleVersion] = useState('bible_TB');
  const [isDbManagerOpen, setIsDbManagerOpen] = useState(false);
  const [selectedSongCategory, setSelectedSongCategory] = useState<string>('Semua');
  const [songCategories, setSongCategories] = useState<string[]>(['Semua']);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Database Manager Upload Form State
  const [uploadDbType, setUploadDbType] = useState<'song' | 'bible'>('song');
  const [uploadDbName, setUploadDbName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingDb, setIsUploadingDb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessUpload = async () => {
    if (!uploadFile) {
      alert("Silakan pilih file TSV atau JSON terlebih dahulu.");
      return;
    }
    const name = uploadDbName.trim();
    if (!name) {
      alert("Silakan masukkan Nama Versi terlebih dahulu.");
      return;
    }

    setIsUploadingDb(true);
    try {
      const text = await uploadFile.text();
      const newId = `${uploadDbType}_${Date.now()}`;
      await addCustomDatabase({ id: newId, name, type: uploadDbType }, text);
      alert(`Database "${name}" berhasil ditambahkan!`);
      const list = await getDatabaseList();
      setDbList(list);

      // Auto-select the newly added version
      if (uploadDbType === 'song') {
        setSelectedSongVersion(newId);
        setSelectedSongCategory('Semua');
      } else {
        setSelectedBibleVersion(newId);
      }

      // Reset upload form
      setUploadFile(null);
      setUploadDbName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error("Gagal memproses file:", err);
      alert("Gagal memproses file: " + (err?.message || 'Format tidak valid'));
    } finally {
      setIsUploadingDb(false);
    }
  };

  // Validasi ID duplikat saat mengedit lagu
  const cleanSelectedId = (selectedItem?.id || '').trim();
  const isIdDuplicate = Boolean(
    isEditingItem &&
    selectedItem &&
    selectedItem.type === 'song' &&
    cleanSelectedId &&
    allSongTitles &&
    allSongTitles.some(s =>
      s.id.toLowerCase().trim() === cleanSelectedId.toLowerCase() &&
      s.id !== originalSongIdRef.current
    )
  );

  const conflictingSong = isIdDuplicate && allSongTitles && cleanSelectedId
    ? allSongTitles.find(s =>
      s.id.toLowerCase().trim() === cleanSelectedId.toLowerCase() &&
      s.id !== originalSongIdRef.current
    )
    : null;

  // Bible Progressive Navigation State
  const [currentBibleBooks, setCurrentBibleBooks] = useState<string[]>([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState<string | null>(null);
  const [selectedBibleChapter, setSelectedBibleChapter] = useState<number | null>(null);
  const [bibleChaptersCount, setBibleChaptersCount] = useState<number>(0);
  const [bibleVersesCount, setBibleVersesCount] = useState<number>(0);
  const [isLoadingBibleMeta, setIsLoadingBibleMeta] = useState(false);

  const [isDisplayOpen, setIsDisplayOpen] = useState(globalIsDisplayOpen);
  const displayWindowRef = useRef<Window | null>(globalDisplayWindow);

  useEffect(() => {
    setGlobalDisplayWindow(displayWindowRef.current);
    setGlobalIsDisplayOpen(isDisplayOpen);
  }, [isDisplayOpen]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (displayWindowRef.current && displayWindowRef.current.closed) {
        setIsDisplayOpen(false);
        displayWindowRef.current = null;
        setGlobalDisplayWindow(null);
        setGlobalIsDisplayOpen(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    initDefaultDatabases().then(() => {
      getDatabaseList().then(setDbList);
    });
  }, []);

  useEffect(() => {
    if (searchType === 'song') {
      getAllLocalSongTitles(selectedSongVersion).then(res => {
        if (Array.isArray(res)) setAllSongTitles(res);
      }).catch(err => console.error("Gagal memuat judul lagu", err));

      getLocalSongCategories(selectedSongVersion).then(res => {
        if (Array.isArray(res)) setSongCategories(['Semua', ...res]);
      }).catch(err => console.error("Gagal memuat kategori", err));
    }
  }, [searchType, selectedSongVersion]);

  useEffect(() => {
    if (searchType === 'bible') {
      getBibleBooksList(selectedBibleVersion).then(res => {
        if (Array.isArray(res)) setCurrentBibleBooks(res);
      }).catch(err => console.error("Gagal memuat daftar kitab", err));
    }
  }, [searchType, selectedBibleVersion]);

  const lastSearchedRef = useRef({ query: '', type: '', songVersion: '', bibleVersion: '', songCategory: '' });

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  // Gunakan BroadcastChannel untuk sinkronisasi ke DisplayWindow
  const channel = new BroadcastChannel('worship_live_sync');

  const openDisplay = () => {
    if (displayWindowRef.current && !displayWindowRef.current.closed) {
      displayWindowRef.current.close();
      displayWindowRef.current = null;
      setIsDisplayOpen(false);
      setGlobalDisplayWindow(null);
      setGlobalIsDisplayOpen(false);
    } else {
      displayWindowRef.current = window.open('#/display', '_blank', 'width=1280,height=720');
      setIsDisplayOpen(true);
      setGlobalDisplayWindow(displayWindowRef.current);
      setGlobalIsDisplayOpen(true);
    }
  };

  const handlePresent = (idx: number) => {
    if (!selectedItem) return;
    setActiveSegment(idx);
    channel.postMessage({
      type: 'STATE_UPDATE',
      state: {
        item: selectedItem,
        segmentIndex: idx,
        displayMode: 'content'
      }
    });
  };

  const handleNext = () => {
    if (!selectedItem || activeSegment === null) return;
    if (activeSegment < selectedItem.segments.length - 1) {
      handlePresent(activeSegment + 1);
    }
  };

  const handlePrev = () => {
    if (!selectedItem || activeSegment === null) return;
    if (activeSegment > 0) {
      handlePresent(activeSegment - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (activeSegment === null) return; // Only control if we're live

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          handlePrev();
          break;
      }
    };
    const channel = new BroadcastChannel('worship_live_sync');
    const handleRemoteKey = (e: MessageEvent) => {
      if (e.data && e.data.type === 'REMOTE_KEYDOWN') {
        const fakeEvent = { key: e.data.key, preventDefault: () => { } } as KeyboardEvent;
        handleKeyDown(fakeEvent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    channel.addEventListener('message', handleRemoteKey);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      channel.removeEventListener('message', handleRemoteKey);
      channel.close();
    };
  }, [selectedItem, activeSegment]);

  // Auto-scroll ke segment yang sedang live
  useEffect(() => {
    if (activeSegment !== null) {
      const el = document.getElementById(`segment-${activeSegment}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegment]);

  const performSearch = async (query: string, type: string, autoSelectFirst = false, forceRefresh = false) => {

    if (!forceRefresh &&
      lastSearchedRef.current.query === query &&
      lastSearchedRef.current.type === type &&
      lastSearchedRef.current.songVersion === selectedSongVersion &&
      lastSearchedRef.current.bibleVersion === selectedBibleVersion &&
      lastSearchedRef.current.songCategory === selectedSongCategory &&
      !autoSelectFirst) {
      return;
    }

    lastSearchedRef.current = { query, type, songVersion: selectedSongVersion, bibleVersion: selectedBibleVersion, songCategory: selectedSongCategory };
    setIsSearching(true);

    if (!autoSelectFirst) {
      setSelectedItem(null);
      setSelectedResultIds([]);
      setActiveSegment(null);
      setIsEditingItem(false);
    }

    try {
      let resultsData: any[] = [];
      if (type === 'song') {
        const res = await searchLocalSongs(query, selectedSongVersion, selectedSongCategory);
        resultsData = res.slice(0, 2000).map((item: any) => {
          let segs = item.segments || [];
          let labs = item.segmentLabels || segs.map((_: any, i: number) => `Slide ${i + 1}`);
          if (segs.length > 0 && segs[0] !== item.title) {
            segs = [item.title, ...segs];
            labs = ['Judul', ...labs];
          }
          return { ...item, type: 'song', segments: segs, segmentLabels: labs, segmentOrder: segs.map((_: any, i: number) => i) };
        });
      } else {
        const res = await searchLocalBible(query, selectedBibleVersion);
        resultsData = res.map((item: any, idx: number) => {
          const bTitle = item.isRange ? item.title : `${item.book} ${item.chapter}:${item.verse}`;
          let segs = item.isRange ? item.segments : [item.text];
          let labs = item.isRange ? item.segmentLabels : [`Ayat ${item.verse}`];
          if (segs.length > 0 && segs[0] !== bTitle) {
            segs = [bTitle, ...segs];
            labs = ['Judul', ...labs];
          }
          return {
            id: item.isRange ? item.id : `b_${idx}`,
            type: 'bible',
            title: bTitle,
            author: 'Alkitab',
            category: 'Alkitab',
            segments: segs,
            segmentLabels: labs,
            segmentOrder: segs.map((_: any, i: number) => i)
          };
        });
      }

      let processedData = resultsData;
      if (showFavorites) {
        processedData = processedData.filter((item: any) => isFavorite(item.id));
      }
      setResults(processedData);
      if (autoSelectFirst && processedData && processedData.length > 0) {
        setSelectedResultIds([processedData[0].id]);
      }

    } catch (err) {
      console.error(err);
      alert('Gagal mencari data');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!showFavorites) {
        performSearch(searchQuery, searchType);
      } else {
        setResults(favorites.filter(f => f.type === searchType && (searchQuery.trim() ? f.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) : true)));
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery, searchType, showFavorites, favorites, selectedSongVersion, selectedBibleVersion, selectedSongCategory]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, searchType);
  };

  const handleQuickOpenSong = async (id: string) => {
    try {
      const res = await searchLocalSongs(id, selectedSongVersion);
      if (res && res.length > 0) {
        const exact = res.find((s: any) => s.id == id) || res[0];
        const processed = { ...exact, type: 'song' };
        originalSongIdRef.current = processed.id;
        setSelectedItem(JSON.parse(JSON.stringify(processed)));
        setSelectedResultIds([processed.id]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedResultIds.length === 0) {
      originalSongIdRef.current = null;
      setSelectedItem(null);
      return;
    }

    // Sort selected items according to their original order in `results`
    const selectedItemsList = results.filter(r => selectedResultIds.includes(r.id));
    if (selectedItemsList.length === 0) return;

    if (selectedItemsList.length === 1) {
      originalSongIdRef.current = selectedItemsList[0].id;
      setSelectedItem(JSON.parse(JSON.stringify(selectedItemsList[0])));
      return;
    }

    if (searchType === 'bible') {
      const combinedSegments = selectedItemsList.map(r => r.segments[0]);
      const combinedLabels = selectedItemsList.map(r => r.title);
      const firstTitle = selectedItemsList[0].title;
      const lastTitle = selectedItemsList[selectedItemsList.length - 1].title;

      originalSongIdRef.current = null;
      setSelectedItem({
        id: selectedItemsList.map(r => r.id).join('_'),
        type: 'bible',
        title: `${firstTitle} - ${lastTitle.split(' ').pop()}`,
        segments: combinedSegments,
        segmentLabels: combinedLabels
      });
    } else {
      // Fallback for song (only show first selected)
      originalSongIdRef.current = selectedItemsList[0].id;
      setSelectedItem(JSON.parse(JSON.stringify(selectedItemsList[0])));
    }
  }, [selectedResultIds, results, searchType]);

  const handleSaveItem = async () => {
    if (!selectedItem) return;
    if (searchType !== 'song' && selectedItem.type !== 'song') {
      alert('Maaf, saat ini hanya data Lagu yang bisa disimpan secara permanen ke database.');
      setIsEditingItem(false);
      return;
    }

    const cleanId = (selectedItem.id || '').trim().replace(/\s+/g, '_');
    if (!cleanId) {
      alert('Peringatan: ID / No Lagu tidak boleh kosong.');
      return;
    }

    // Ensure selectedItem has the correct type before saving
    selectedItem.type = 'song';
    const targetVersion = selectedSongVersion || 'song_LSEB';
    const originalId = originalSongIdRef.current || cleanId;

    // 1. Validasi bentrok ID dengan lagu lain di database aktif
    const targetDbKey = `dbdata_${targetVersion}`;
    const baseSongs: any[] = (await get(targetDbKey)) || [];
    const conflictSong = baseSongs.find((s: any) =>
      s.id.toLowerCase().trim() === cleanId.toLowerCase() &&
      s.id !== originalId
    );
    if (conflictSong) {
      alert(`Peringatan: ID "${cleanId}" sudah digunakan oleh lagu "${conflictSong.title}".\n\nID lagu tidak boleh sama agar tidak terjadi duplikasi atau bentrok data.`);
      return;
    }

    setIsSavingItem(true);
    try {
      // 2. Simpan/Perbarui langsung di database lokal yang sedang aktif (IN-PLACE update!)
      const existingIdx = baseSongs.findIndex((s: any) => s.id === originalId || s.id === cleanId);
      let updatedBase = [...baseSongs];

      const songToSave = {
        ...selectedItem,
        id: cleanId,
        title: selectedItem.title || "Untitled",
        author: selectedItem.author || "",
        category: selectedItem.category || "Custom",
        key: selectedItem.key || "",
        beat: selectedItem.beat || "",
        versionId: targetVersion,
        segmentOrder: Array.from({ length: (selectedItem.segments || []).length }, (_, i) => i),
        segments: selectedItem.segments || [],
        segmentLabels: selectedItem.segmentLabels || (selectedItem.segments || []).map((_: any, i: number) => `Slide ${i + 1}`)
      };

      if (existingIdx >= 0) {
        // Edit lagu yang sudah ada: perbarui di tempat (meski ID diubah)
        updatedBase[existingIdx] = songToSave;
      } else {
        // Lagu baru
        updatedBase.push(songToSave);
      }
      await set(targetDbKey, updatedBase);

      // 3. Simpan ke sistem backend/Electron
      await callApi('saveSongItem', {}, {
        method: 'POST',
        payload: {
          ...songToSave,
          originalId: originalId,
          versionId: targetVersion
        }
      });

      // 4. Bersihkan record lama dari GAS_SYNC jika ID diubah atau ditimpa
      const currentSync = (await get('dbdata_song_GAS_SYNC')) || [];
      if (Array.isArray(currentSync) && currentSync.length > 0) {
        const cleanedSync = currentSync.filter((s: any) => s.id !== originalId && s.id !== songToSave.id);
        await set('dbdata_song_GAS_SYNC', cleanedSync);
      }

      originalSongIdRef.current = songToSave.id;
      setSelectedItem(songToSave);
      setSelectedResultIds([songToSave.id]);
      setIsEditingItem(false);

      // 4. Refresh local views
      const newTitles = await getAllLocalSongTitles(targetVersion);
      if (Array.isArray(newTitles)) setAllSongTitles(newTitles);

      const cats = await getLocalSongCategories(targetVersion);
      if (Array.isArray(cats)) setSongCategories(['Semua', ...cats]);

      if (searchQuery !== '') {
        const newRes = await searchLocalSongs(searchQuery, targetVersion, selectedSongCategory);
        setResults(newRes);
      } else {
        performSearch('', 'song', false, true);
      }

      alert('Lagu berhasil diperbarui dan disimpan!');
    } catch (err: any) {
      console.error("Gagal menyimpan lagu:", err);
      alert('Error saat menyimpan ke server: ' + (err?.message || 'Error'));
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!selectedItem || !selectedItem.id) return;
    if (!confirm(`Anda yakin ingin menghapus lagu "${selectedItem.title}" secara permanen?`)) return;

    const targetVersion = selectedSongVersion || 'song_LSEB';
    const idToDelete = selectedItem.id;

    setIsDeletingSong(true);
    try {
      // 1. Hapus langsung dari database aktif
      const targetDbKey = `dbdata_${targetVersion}`;
      const baseSongs: any[] = (await get(targetDbKey)) || [];
      const updatedBase = baseSongs.filter((s: any) => s.id !== idToDelete);
      await set(targetDbKey, updatedBase);

      // 2. Hapus dari GAS_SYNC
      const currentSync = await get('dbdata_song_GAS_SYNC') || [];
      const filteredSync = currentSync.filter((s: any) => s.id !== idToDelete);
      await set('dbdata_song_GAS_SYNC', filteredSync);

      // 3. Hapus dari backend
      await callApi('deleteSongItem', {}, { method: 'POST', payload: { id: idToDelete, versionId: targetVersion } });

      originalSongIdRef.current = null;
      setSelectedItem(null);
      setSelectedResultIds([]);
      setIsEditingItem(false);

      // Refresh view
      const newTitles = await getAllLocalSongTitles(targetVersion);
      if (Array.isArray(newTitles)) setAllSongTitles(newTitles);

      if (searchQuery !== '') {
        const resSearch = await searchLocalSongs(searchQuery, targetVersion, selectedSongCategory);
        setResults(resSearch);
      } else {
        performSearch('', 'song', false, true);
      }

      alert('Lagu berhasil dihapus.');
    } catch (err: any) {
      console.error(err);
      alert('Gagal menghapus lagu: ' + (err?.message || 'Error'));
    } finally {
      setIsDeletingSong(false);
    }
  };

  const handleDropSegment = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = Number(e.dataTransfer.getData('text/plain'));
    if (fromIdx === toIdx || isNaN(fromIdx)) return;

    if (!selectedItem) return;
    const newItem = { ...selectedItem };

    const segment = newItem.segments.splice(fromIdx, 1)[0];
    newItem.segments.splice(toIdx, 0, segment);

    if (newItem.segmentLabels) {
      const label = newItem.segmentLabels.splice(fromIdx, 1)[0];
      newItem.segmentLabels.splice(toIdx, 0, label);
    }

    setSelectedItem(newItem);
    setDragSegmentIdx(null);
  };

  const filteredSongTitles = allSongTitles ? allSongTitles.filter((s: any) => selectedSongCategory === 'Semua' || s.category === selectedSongCategory) : null;

  return (
    <div className="h-full p-4 flex flex-col gap-4">
      <header className="glass-panel p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900 flex items-center gap-2">
            <ArrowLeft size={16} /> Kembali
          </button>
          <h1 className="text-xl font-heading font-extrabold text-indigo-900 tracking-tight drop-shadow-sm flex items-center">
            Library (Database)
            <FooterClock />
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <SyncButton />
          <button
            onClick={openDisplay}
            className={`flex items-center gap-2 px-4 py-2 font-bold rounded-full transition shadow-md ${isDisplayOpen
              ? 'bg-rose-500 hover:bg-rose-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-[#C5A059] dark:hover:bg-[#A38347]'
              }`}
          >
            <Monitor size={16} className={isDisplayOpen ? "animate-pulse" : ""} />
            {isDisplayOpen ? 'Tutup Display' : 'Buka Display'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        <section className="w-full h-[45%] md:h-auto md:w-1/3 glass-panel p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-indigo-900 dark:text-[#C5A059]">Pencarian Data</h2>
            {searchType === 'song' && (
              <button
                onClick={() => {
                  originalSongIdRef.current = null;
                  setSelectedItem({
                    id: "song_" + Date.now(),
                    type: 'song',
                    title: 'Judul Lagu Baru',
                    author: 'NN',
                    segments: ['Lirik baris 1\nLirik baris 2'],
                    segmentLabels: ['Bait 1']
                  });
                  setIsEditingItem(true);
                  setActiveSegment(0);
                }}
                className="p-1.5 rounded-lg transition-all shadow-sm font-semibold bg-green-500/10 dark:bg-transparent text-green-700 dark:text-green-500 border border-green-500/30 dark:border-white/10 hover:bg-green-500/20 dark:hover:bg-white/5"
                title="Tambah Lagu Baru"
              >
                <Plus size={18} />
              </button>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <button onClick={() => { setSearchType('song'); setResults([]); setSelectedItem(null); setSelectedResultIds([]); setSearchQuery(''); }} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'song' ? 'bg-indigo-600 dark:!bg-[#C5A059] text-white shadow-md dark:shadow-none' : 'bg-white/30 dark:bg-transparent text-indigo-900 dark:text-[#C5A059] dark:border dark:border-white/10 hover:bg-white/40 dark:hover:bg-white/5'}`}><Music size={16} /> Lagu</button>
            <button onClick={() => {
              setSearchType('bible');
              setResults([]);
              setSelectedItem(null);
              setSelectedResultIds([]);
              setSelectedBibleBook(null);
              setSelectedBibleChapter(null);
              setSearchQuery('');
            }} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'bible' ? 'bg-indigo-600 dark:!bg-[#C5A059] text-white shadow-md dark:shadow-none' : 'bg-white/30 dark:bg-transparent text-indigo-900 dark:text-[#C5A059] dark:border dark:border-white/10 hover:bg-white/40 dark:hover:bg-white/5'}`}><BookOpen size={16} /> Alkitab</button>
          </div>

          <div className="mb-4 flex gap-2">
            <select
              className="flex-1 bg-white/50 dark:bg-transparent border border-indigo-200 dark:border-white/10 rounded-lg px-2 py-2 text-sm text-indigo-900 dark:text-[#C5A059] font-semibold focus:outline-none focus:border-indigo-500 dark:focus:border-[#D4B872] transition"
              value={searchType === 'song' ? selectedSongVersion : selectedBibleVersion}
              onChange={(e) => searchType === 'song' ? setSelectedSongVersion(e.target.value) : setSelectedBibleVersion(e.target.value)}
            >
              {dbList.filter(d => d.type === searchType).map(db => (
                <option key={db.id} value={db.id} className="dark:bg-[#0A1128] dark:text-[#C5A059]">{db.name}</option>
              ))}
            </select>
            <button
              onClick={() => setIsDbManagerOpen(true)}
              className="p-2 bg-indigo-50 dark:bg-transparent text-indigo-900 dark:text-[#C5A059] border border-indigo-200 dark:border-white/10 rounded-lg hover:bg-indigo-100 dark:hover:bg-white/5 transition shadow-sm dark:shadow-none flex items-center justify-center"
              title="Kelola Database (Tambah Versi)"
            >
              <Settings size={18} />
            </button>
          </div>

          {searchType === 'song' && (
            <div className="mb-4">
              <select
                className="w-full bg-white/50 dark:bg-transparent border border-indigo-200 dark:border-white/10 rounded-lg px-2 py-2 text-sm text-indigo-900 dark:text-[#C5A059] font-semibold focus:outline-none focus:border-indigo-500 dark:focus:border-[#D4B872] transition"
                value={selectedSongCategory}
                onChange={(e) => setSelectedSongCategory(e.target.value)}
              >
                {songCategories.map(cat => (
                  <option key={cat} value={cat} className="dark:bg-[#0A1128] dark:text-[#C5A059]">{cat}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 mb-5">
            <button
              onClick={() => {
                const newShowFavs = !showFavorites;
                setShowFavorites(newShowFavs);
              }}
              className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-sm border ${showFavorites ? 'bg-yellow-400 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-600/50 text-yellow-900 dark:text-yellow-400 shadow-yellow-400/50 scale-105' : 'bg-white/40 dark:bg-transparent border-white/40 dark:border-white/10 text-indigo-900 dark:text-[#C5A059] hover:bg-white/60 dark:hover:bg-white/5'}`}
              title="Tampilkan hanya favorit"
            >
              <Star size={20} className={showFavorites ? 'text-yellow-600 stroke-[2.5px]' : ''} />
            </button>
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 relative">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Cari ${searchType === 'song' ? 'Lagu' : 'Alkitab'}...`}
                  className="glass-input w-full pr-10"
                  id="searchInputBox"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      document.getElementById('searchInputBox')?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-indigo-900/50 hover:text-indigo-900 hover:bg-indigo-900/10 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Hapus Pencarian"
                  >
                    <span className="font-extrabold text-sm font-sans">X</span>
                  </button>
                )}
              </div>
              <button type="submit" disabled={isSearching} className="glass-button bg-indigo-500/20 dark:bg-transparent text-indigo-900 dark:text-[#C5A059] border-indigo-500/30 dark:border-white/10 dark:hover:bg-white/5">
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>
          </div>

          {searchType === 'song' && (
            <div className="flex justify-center gap-2 mb-3 shrink-0">
              <button onClick={() => setViewMode('grid')} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'grid' ? 'bg-indigo-600 dark:!bg-[#C5A059] text-white dark:border dark:border-[#C5A059]' : 'bg-white dark:bg-transparent text-indigo-900 dark:text-[#C5A059] border border-indigo-200 dark:border-white/10'}`}>Nomor Saja</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'list' ? 'bg-indigo-600 dark:!bg-[#C5A059] text-white dark:border dark:border-[#C5A059]' : 'bg-white dark:bg-transparent text-indigo-900 dark:text-[#C5A059] border border-indigo-200 dark:border-white/10'}`}>Nomor & Judul</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {searchType === 'bible' && results.map((res) => {
              const isSelected = selectedResultIds.includes(res.id);
              return (
                <div
                  key={res.id}
                  className={`w-full flex items-stretch rounded-xl border transition overflow-hidden ${isSelected
                    ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 dark:bg-white/10 dark:border-[#C5A059] dark:ring-1 dark:ring-[#C5A059]'
                    : 'bg-white/40 border-white/20 hover:bg-white/60 hover:bg-indigo-600/10 dark:bg-[#282828] dark:border-white/10 dark:hover:bg-white/5'
                    }`}
                >
                  <button
                    onClick={(e) => {
                      let newSelection = [...selectedResultIds];
                      if (e.ctrlKey || e.metaKey) {
                        if (newSelection.includes(res.id)) {
                          newSelection = newSelection.filter(id => id !== res.id);
                        } else {
                          newSelection.push(res.id);
                        }
                      } else if (e.shiftKey && newSelection.length > 0) {
                        const lastId = newSelection[newSelection.length - 1];
                        const lastIndex = results.findIndex(r => r.id === lastId);
                        const currentIndex = results.findIndex(r => r.id === res.id);
                        if (lastIndex !== -1 && currentIndex !== -1) {
                          const start = Math.min(lastIndex, currentIndex);
                          const end = Math.max(lastIndex, currentIndex);
                          const rangeIds = results.slice(start, end + 1).map(r => r.id);
                          newSelection = [...new Set([...newSelection, ...rangeIds])];
                        } else {
                          newSelection = [res.id];
                        }
                      } else {
                        newSelection = [res.id];
                      }

                      setSelectedResultIds(newSelection);
                      setActiveSegment(null);
                      setIsEditingItem(false);
                    }}
                    className="flex-1 text-left p-3"
                  >
                    <div className="font-semibold text-indigo-900 dark:text-[#D4B872]">{res.title}</div>
                    <div className="text-xs text-indigo-800/60 dark:text-slate-400 line-clamp-1">{res.segments && res.segments.length > 1 ? res.segments[1] : res.segments?.[0]}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(res);
                    }}
                    className="px-4 border-l border-white/20 flex items-center justify-center transition hover:bg-white/50 dark:hover:bg-white/10"
                    title={isFavorite(res.id) ? "Hapus dari Favorit" : "Tambahkan ke Favorit"}
                  >
                    <Star size={18} className={isFavorite(res.id) ? "text-yellow-500 stroke-[2.5px]" : "text-indigo-300 dark:text-slate-500"} />
                  </button>
                </div>
              );
            })}

            {searchType === 'bible' && results.length === 0 && !isSearching && searchQuery !== '' && (
              <div className="text-center text-sm text-indigo-900/60 p-4">Tidak ada hasil ditemukan.</div>
            )}

            {searchType === 'song' && (
              <div className="p-1">
                {(() => {
                  const displaySongs = (results.length > 0 || (searchQuery !== '' && !isSearching)) ? results : filteredSongTitles;
                  if (!displaySongs || (displaySongs.length === 0 && !isSearching)) {
                    return <div className="text-center text-sm text-indigo-900/60 p-4">Tidak ada hasil ditemukan.</div>;
                  }

                  return viewMode === 'grid' ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {displaySongs.map((song: any) => {
                        const isSelected = selectedResultIds.includes(song.id);
                        return (
                          <button
                            key={song.id}
                            onClick={() => {
                              handleQuickOpenSong(song.id.toString());
                            }}
                            className={`relative py-2 px-1 text-center text-xs font-semibold rounded-md transition shadow-sm overflow-hidden text-ellipsis whitespace-nowrap border ${isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-[#C5A059] dark:text-black dark:border-[#C5A059]'
                              : 'text-indigo-900 bg-white/40 border-white/20 hover:bg-indigo-600 hover:text-white dark:bg-[#282828] dark:border-white/10 dark:text-[#C5A059] dark:hover:bg-[#333] dark:hover:text-[#D4B872]'
                              }`}
                            title={song.title}
                          >
                            {song.id}
                            {isFavorite(song.id) && <Star size={10} className={`absolute top-1 right-1 ${isSelected ? 'text-white fill-white dark:text-black dark:fill-black' : 'text-yellow-500 fill-yellow-500'}`} />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {displaySongs.map((song: any) => {
                        const isSelected = selectedResultIds.includes(song.id);
                        return (
                          <div key={song.id} className={`w-full flex items-stretch rounded-md border transition overflow-hidden ${isSelected
                            ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 dark:bg-white/10 dark:border-[#C5A059] dark:ring-1 dark:ring-[#C5A059]'
                            : 'bg-white/40 border-white/20 hover:bg-indigo-600/10 dark:bg-[#282828] dark:border-white/10 dark:hover:bg-white/5'
                            }`}>
                            <button
                              onClick={(e) => {
                                let newSelection = [...selectedResultIds];
                                if (e.ctrlKey || e.metaKey) {
                                  if (newSelection.includes(song.id)) {
                                    newSelection = newSelection.filter(id => id !== song.id);
                                  } else {
                                    newSelection.push(song.id);
                                  }
                                } else {
                                  newSelection = [song.id];
                                }
                                setSelectedResultIds(newSelection);
                                setActiveSegment(null);
                                setIsEditingItem(false);
                                handleQuickOpenSong(song.id.toString());
                              }}
                              className="flex-1 p-2 text-left text-sm font-semibold text-indigo-900 transition flex items-center gap-3 dark:text-[#C5A059]"
                            >
                              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs min-w-[32px] text-center shrink-0 dark:bg-[#444] dark:text-[#D4B872]">{song.id}</span>
                              <div className="flex flex-col flex-1 truncate text-left">
                                <span className="line-clamp-1 break-all">{song.title}</span>
                                {(song.author || song.key || song.beat || song.category) && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[9px] text-indigo-600/80 dark:text-slate-400">
                                    {song.author && <span className="truncate max-w-[100px]" title={song.author}>👤 {song.author}</span>}
                                    {song.key && <span title="Nada Dasar">🎵 {song.key}</span>}
                                    {song.beat && <span title="Ketukan">⏱ {song.beat}</span>}
                                    {song.category && <span title="Kategori">🏷️ {song.category}</span>}
                                  </div>
                                )}
                              </div>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (song.segments) {
                                  toggleFavorite(song);
                                } else {
                                  const fullSong = await searchLocalSongs(song.id, selectedSongVersion);
                                  if (fullSong && fullSong.length > 0) {
                                    toggleFavorite({ ...fullSong[0], type: 'song' });
                                  } else {
                                    toggleFavorite({ ...song, segments: ['(Lirik tidak tersedia)'], type: 'song' });
                                  }
                                }
                              }}
                              className="px-4 border-l border-white/20 flex items-center justify-center transition hover:bg-white/50 dark:hover:bg-white/10"
                              title={isFavorite(song.id) ? "Hapus dari Favorit" : "Tambahkan ke Favorit"}
                            >
                              <Star size={18} className={isFavorite(song.id) ? "text-yellow-500 fill-yellow-500" : "text-indigo-300 dark:text-white/20"} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
            {searchType === 'bible' && results.length === 0 && !isSearching && searchQuery === '' && (
              <div className="flex flex-col h-full p-1">
                {!selectedBibleBook ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentBibleBooks.length > 0 ? currentBibleBooks.map(book => (
                      <button
                        key={book}
                        onClick={async () => {
                          setSelectedBibleBook(book);
                          setIsLoadingBibleMeta(true);
                          const maxC = await getBibleBookMetadata(selectedBibleVersion, book);
                          setBibleChaptersCount(maxC);
                          setIsLoadingBibleMeta(false);
                        }}
                        className="p-2 text-left text-xs font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition line-clamp-1 shadow-sm dark:bg-[#282828] dark:border-white/10 dark:text-[#C5A059] dark:hover:bg-[#333] dark:hover:text-[#D4B872]"
                      >
                        {book}
                      </button>
                    )) : (
                      <div className="col-span-2 text-center p-4"><Loader2 size={24} className="animate-spin text-indigo-500 mx-auto" /></div>
                    )}
                  </div>
                ) : !selectedBibleChapter ? (
                  <div className="flex flex-col">
                    <button
                      onClick={() => setSelectedBibleBook(null)}
                      className="mb-3 w-full p-2 bg-indigo-100 text-indigo-900 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-200 transition font-bold shadow-sm dark:bg-slate-800 dark:text-[#D4B872] dark:hover:bg-slate-700 dark:border dark:border-white/10"
                    >
                      <ArrowLeft size={16} /> Kembali ke Kitab
                    </button>
                    <div className="font-bold text-indigo-900 dark:text-[#D4B872] mb-2 text-center">{selectedBibleBook} - Pilih Pasal</div>
                    {isLoadingBibleMeta ? (
                      <div className="text-center p-4"><Loader2 size={24} className="animate-spin text-indigo-500 mx-auto" /></div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: bibleChaptersCount }, (_, i) => i + 1).map(chap => (
                          <button
                            key={chap}
                            onClick={async () => {
                              setSelectedBibleChapter(chap);
                              setIsLoadingBibleMeta(true);
                              const maxV = await getBibleChapterMetadata(selectedBibleVersion, selectedBibleBook, chap);
                              setBibleVersesCount(maxV);
                              setIsLoadingBibleMeta(false);
                            }}
                            className="py-2.5 text-center text-sm font-bold text-indigo-900 bg-white/60 border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-sm dark:bg-[#282828] dark:border-white/10 dark:text-[#C5A059] dark:hover:bg-[#333] dark:hover:text-[#D4B872] dark:hover:border-white/20"
                          >
                            {chap}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <button
                      onClick={() => setSelectedBibleChapter(null)}
                      className="mb-3 w-full p-2 bg-indigo-100 text-indigo-900 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-200 transition font-bold shadow-sm dark:bg-slate-800 dark:text-[#D4B872] dark:hover:bg-slate-700 dark:border dark:border-white/10"
                    >
                      <ArrowLeft size={16} /> Kembali ke Pasal
                    </button>
                    <div className="font-bold text-indigo-900 dark:text-[#D4B872] mb-2 text-center">{selectedBibleBook} {selectedBibleChapter} - Pilih Ayat</div>
                    <button
                      type="button"
                      onClick={() => {
                        const query = `${selectedBibleBook} ${selectedBibleChapter}`;
                        setSearchQuery(query);
                        performSearch(query, 'bible');
                      }}
                      className="mb-3 w-full py-2 px-3 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:text-[#C5A059] dark:bg-slate-800 border border-indigo-200 dark:border-white/10 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      📖 Tampilkan Seluruh Pasal {selectedBibleChapter} (Ayat 1 - {bibleVersesCount})
                    </button>
                    {isLoadingBibleMeta ? (
                      <div className="text-center p-4"><Loader2 size={24} className="animate-spin text-indigo-500 mx-auto" /></div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: bibleVersesCount }, (_, i) => i + 1).map(verse => (
                          <button
                            key={verse}
                            onClick={() => {
                              const query = `${selectedBibleBook} ${selectedBibleChapter}:${verse}`;
                              setSearchQuery(query);
                              // Eksekusi pencarian secara langsung
                              performSearch(query, 'bible');
                            }}
                            className="py-2.5 text-center text-sm font-bold text-indigo-900 bg-white/60 border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-sm dark:bg-[#282828] dark:border-white/10 dark:text-[#C5A059] dark:hover:bg-[#333] dark:hover:text-[#D4B872] dark:hover:border-white/20"
                          >
                            {verse}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="flex-1 glass-panel p-6 flex flex-col overflow-hidden">
          {selectedItem ? (
            <div className="flex-1 flex flex-col min-h-0 h-full">
              <div className="flex justify-between items-start mb-6 shrink-0">
                <div className="flex-1 mr-4">
                  {isEditingItem ? (
                    <>
                      <input
                        type="text"
                        value={selectedItem.title}
                        onChange={(e) => setSelectedItem({ ...selectedItem, title: e.target.value })}
                        className="w-full text-2xl font-bold text-indigo-900 bg-transparent border border-indigo-200 rounded-lg px-2 py-1 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-[#D4B872] dark:border-white/20 dark:focus:ring-[#C5A059]"
                        placeholder="Judul Lagu"
                      />
                      {selectedItem.type === 'song' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-2">
                            <div className="w-1/4 flex flex-col">
                              <input
                                type="text"
                                value={selectedItem.id}
                                onChange={(e) => setSelectedItem({ ...selectedItem, id: e.target.value.replace(/\s+/g, '_') })}
                                className={`w-full text-sm font-semibold rounded-md px-2 py-1 focus:outline-none transition-all ${isIdDuplicate
                                  ? 'border-2 border-red-500 bg-red-50/70 text-red-700 dark:bg-red-950/40 dark:text-red-300 focus:ring-2 focus:ring-red-500 shadow-sm'
                                  : 'text-indigo-900 bg-transparent border border-indigo-300 focus:ring-2 focus:ring-indigo-500 dark:text-slate-300 dark:border-white/20 dark:focus:ring-[#C5A059]'
                                  }`}
                                placeholder="ID / No Lagu"
                                title={isIdDuplicate ? `Peringatan: ID sudah digunakan oleh lagu "${conflictingSong?.title}"` : "Nomor atau ID Unik Lagu"}
                              />
                            </div>
                            <input
                              type="text"
                              list="category-options"
                              value={selectedItem.category || ''}
                              onChange={(e) => setSelectedItem({ ...selectedItem, category: e.target.value })}
                              className="w-1/4 text-sm font-semibold text-indigo-900 bg-transparent border border-indigo-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-[#9C8346] dark:border-white/20 dark:focus:ring-[#C5A059]"
                              placeholder="Kategori"
                              title="Kategori Lagu (kosongkan jika tidak ada)"
                            />
                            <datalist id="category-options">
                              {songCategories.filter(c => c !== 'Semua').map(cat => (
                                <option key={cat} value={cat} className="dark:bg-[#0A1128] dark:text-[#C5A059]" />
                              ))}
                            </datalist>
                            <input
                              type="text"
                              value={selectedItem.author || ''}
                              onChange={(e) => setSelectedItem({ ...selectedItem, author: e.target.value })}
                              className="w-1/4 text-sm font-semibold text-indigo-900/60 bg-transparent border border-indigo-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-[#9C8346] dark:border-white/20 dark:focus:ring-[#C5A059]"
                              placeholder="Pencipta"
                            />
                            <input
                              type="text"
                              value={selectedItem.key || ''}
                              onChange={(e) => setSelectedItem({ ...selectedItem, key: e.target.value })}
                              className="w-1/6 text-sm font-semibold text-indigo-900/60 bg-transparent border border-indigo-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-[#9C8346] dark:border-white/20 dark:focus:ring-[#C5A059]"
                              placeholder="Nada (C)"
                            />
                            <input
                              type="text"
                              value={selectedItem.beat || ''}
                              onChange={(e) => setSelectedItem({ ...selectedItem, beat: e.target.value })}
                              className="w-1/6 text-sm font-semibold text-indigo-900/60 bg-transparent border border-indigo-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-[#9C8346] dark:border-white/20 dark:focus:ring-[#C5A059]"
                              placeholder="Ketuk (4/4)"
                            />
                          </div>
                          {isIdDuplicate && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100/90 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold">
                              <span>⚠️ <strong>Peringatan ID Duplikat:</strong> ID <code>"{selectedItem.id}"</code> sudah digunakan oleh lagu <strong>"{conflictingSong?.title}"</strong>. ID tidak boleh sama!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-indigo-900 dark:text-[#D4B872] mb-2">{selectedItem.title}</h2>
                      <div className="flex items-center gap-3">
                        <div className="inline-block px-3 py-1 bg-indigo-100 dark:bg-white/10 text-indigo-800 dark:text-[#C5A059] text-xs font-bold uppercase rounded-full border border-transparent dark:border-white/20">
                          {searchType === 'song' ? (dbList.find(db => db.id === selectedSongVersion)?.name || 'Lagu Sion') : 'Alkitab (TB)'}
                        </div>
                        {selectedItem.author && selectedItem.author !== 'N/A' && (
                          <div className="text-sm font-semibold text-indigo-900/60 dark:text-[#9C8346] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-[#9C8346]"></span>
                            {selectedItem.author}
                          </div>
                        )}
                        {selectedItem.category && selectedItem.category !== 'Semua' && (
                          <div className="text-sm font-semibold text-indigo-900/60 dark:text-[#9C8346] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-[#9C8346]"></span>
                            🏷️ {selectedItem.category}
                          </div>
                        )}
                        {selectedItem.key && (
                          <div className="text-sm font-semibold text-indigo-900/60 dark:text-[#9C8346] flex items-center gap-2" title="Nada Dasar">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-[#9C8346]"></span>
                            🎵 {selectedItem.key}
                          </div>
                        )}
                        {selectedItem.beat && (
                          <div className="text-sm font-semibold text-indigo-900/60 dark:text-[#9C8346] flex items-center gap-2" title="Ketukan">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-[#9C8346]"></span>
                            ⏱ {selectedItem.beat}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditingItem && selectedItem.type === 'song' && (
                    <button
                      onClick={handleDeleteSong}
                      disabled={isDeletingSong || isSavingItem}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition bg-red-100 text-red-700 hover:bg-red-200 shadow-sm border border-red-200 ${isDeletingSong ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Hapus Lagu Permanen"
                    >
                      {isDeletingSong ? <><Loader2 size={16} className="animate-spin" /> Menghapus...</> : <><Trash2 size={16} /> Hapus Lagu</>}
                    </button>
                  )}
                  {isEditingItem && (
                    <button
                      onClick={() => {
                        setIsEditingItem(false);
                        if (selectedItem?.id) handleQuickOpenSong(selectedItem.id.toString());
                      }}
                      disabled={isSavingItem || isDeletingSong}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-sm border border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:border-slate-600 ${isSavingItem || isDeletingSong ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <X size={16} /> Batal
                    </button>
                  )}
                  {selectedItem.type === 'song' && hasChorus(selectedItem) && !isChorusAlreadyEmbedded(selectedItem.segments, selectedItem.segmentLabels) && (
                    <button
                      type="button"
                      onClick={() => {
                        const expanded = expandSongWithChorus(selectedItem);
                        setSelectedItem(expanded);
                        setIsEditingItem(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 dark:border-amber-700 shadow-xs cursor-pointer"
                      title="Sematkan Chorus setelah tiap bait dalam tampilan lagu ini"
                    >
                      ⚡ Sisipkan Chorus Tiap Bait
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (isEditingItem) {
                        handleSaveItem();
                      } else {
                        setIsEditingItem(true);
                      }
                    }}
                    disabled={isSavingItem || isDeletingSong || (isEditingItem && isIdDuplicate)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${isEditingItem
                      ? isIdDuplicate
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'glass-button text-indigo-900'
                      } ${isSavingItem || isDeletingSong ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isEditingItem && isIdDuplicate ? `Tidak dapat menyimpan: ID "${selectedItem.id}" sudah digunakan oleh lagu "${conflictingSong?.title}"` : "Simpan perubahan ke Database"}
                  >
                    {isSavingItem ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : (isEditingItem ? <><Save size={16} /> Simpan ke Database</> : <><Edit size={16} /> Edit Lirik/Slide</>)}
                  </button>
                </div>
              </div>

              <div className={`flex flex-col md:flex-row gap-6 mt-4 flex-1 min-h-0`}>
                <div className={`flex flex-col overflow-y-auto pr-2 ${isEditingItem ? 'w-full md:w-1/2' : 'w-full'}`}>
                  <div className="space-y-4">
                    {selectedItem.segments.map((seg, idx) => (
                      <div
                        key={idx}
                        id={`segment-${idx}`}
                        draggable={isEditingItem}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', idx.toString());
                          setDragSegmentIdx(idx);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropSegment(e, idx)}
                        onDragEnd={() => setDragSegmentIdx(null)}
                        className={`w-full text-left p-4 rounded-lg border shadow-sm transition group relative overflow-hidden ${activeSegment === idx
                          ? 'bg-indigo-600 border-indigo-700 dark:bg-indigo-600/30 dark:border-[#C5A059]'
                          : 'bg-transparent border-indigo-200 dark:border-white/20 hover:border-indigo-400 dark:hover:border-white/40'
                          } ${dragSegmentIdx === idx ? 'opacity-50' : ''} ${isEditingItem ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          {isEditingItem ? (
                            <input
                              type="text"
                              value={selectedItem.segmentLabels?.[idx] || `Slide ${idx + 1}`}
                              onChange={(e) => {
                                const newItem = { ...selectedItem };
                                if (!newItem.segmentLabels) {
                                  newItem.segmentLabels = newItem.segments.map((_, i) => `Slide ${i + 1}`);
                                }
                                newItem.segmentLabels[idx] = e.target.value;
                                setSelectedItem(newItem);
                              }}
                              className="bg-transparent border border-indigo-200 text-indigo-900 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded w-32 dark:text-[#00E5FF] dark:border-[#00E5FF]/50"
                            />
                          ) : (
                            <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activeSegment === idx ? 'text-indigo-200 dark:text-[#00E5FF]' : 'text-indigo-400 dark:text-[#00E5FF]/70'}`}>
                              {selectedItem.segmentLabels ? selectedItem.segmentLabels[idx] : `Slide ${idx + 1}`}
                              {activeSegment === idx && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] text-white animate-pulse">LIVE SEKARANG</span>}
                              {activeSegment !== idx && <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] text-indigo-600">Klik untuk Tampilkan</span>}
                            </div>
                          )}

                          {isEditingItem && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const newItem = { ...selectedItem };
                                  const segToCopy = newItem.segments[idx];
                                  const labelToCopy = newItem.segmentLabels ? newItem.segmentLabels[idx] : `Slide ${idx + 1}`;

                                  newItem.segments.splice(idx + 1, 0, segToCopy);
                                  if (newItem.segmentLabels) {
                                    newItem.segmentLabels.splice(idx + 1, 0, labelToCopy);
                                  }
                                  setSelectedItem(newItem);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 shadow-sm"
                                title="Duplikat bait ini"
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  const newItem = { ...selectedItem };
                                  newItem.segments.splice(idx, 1);
                                  if (newItem.segmentLabels) newItem.segmentLabels.splice(idx, 1);
                                  setSelectedItem(newItem);
                                }}
                                className="text-red-500 hover:text-red-700 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100 shadow-sm"
                                title="Hapus bait ini"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditingItem ? (
                          <textarea
                            value={seg}
                            onFocus={() => setActiveSegment(idx)}
                            onChange={(e) => {
                              const newItem = { ...selectedItem };
                              newItem.segments[idx] = e.target.value;
                              setSelectedItem(newItem);
                            }}
                            className="w-full h-24 bg-transparent border border-indigo-200 text-indigo-900 text-lg whitespace-pre-wrap leading-relaxed p-2 rounded focus:outline-none focus:border-indigo-500 dark:text-[#D4B872] dark:border-white/20 dark:focus:border-[#C5A059]"
                          />
                        ) : (
                          <div
                            onClick={() => handlePresent(idx)}
                            className={`text-lg whitespace-pre-wrap leading-relaxed cursor-pointer ${activeSegment === idx ? 'text-white dark:text-[#D4B872]' : 'text-indigo-900 dark:text-[#D4B872]/80'}`}
                          >
                            {seg}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {isEditingItem && (
                    <button
                      onClick={() => {
                        const newItem = { ...selectedItem };
                        newItem.segments.push("Lirik/Teks Baru...");
                        if (newItem.segmentLabels) {
                          newItem.segmentLabels.push("Chorus");
                        } else {
                          newItem.segmentLabels = newItem.segments.map((_, i) => i === newItem.segments.length - 1 ? "Chorus" : `Slide ${i + 1}`);
                        }
                        setSelectedItem(newItem);
                      }}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 font-bold hover:bg-indigo-50 transition"
                    >
                      <Plus size={18} /> Tambah Slide / Chorus Baru
                    </button>
                  )}

                  <div className="h-24 shrink-0"></div> {/* Spacer agar konten bisa di-scroll melewati tombol sticky */}
                </div>

                <div className="w-full md:w-1/2 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-indigo-200/50 pt-4 md:pt-0 md:pl-6 shrink-0">
                  <h3 className="font-bold text-indigo-900 dark:text-slate-200 flex items-center gap-2">
                    <Monitor size={18} /> Live Preview Slide
                  </h3>
                  <div
                    className="w-full aspect-video bg-black rounded-xl overflow-hidden relative shadow-lg flex items-center justify-center border-[4px] md:border-[6px] border-slate-800"
                    style={{
                      ...(getBgUrl(customBg)?.type === 'image' ? {
                        backgroundImage: getBgUrl(customBg)?.url ? `url('${getBgUrl(customBg)?.url}')` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      } : {}),
                      containerType: 'inline-size'
                    }}
                  >
                    {getBgUrl(customBg)?.type === 'video' && (
                      <video
                        src={getBgUrl(customBg)?.url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover z-0"
                      />
                    )}
                    {/* Background Dim & Vignette */}
                    <div
                      className="absolute inset-0 z-0 transition-opacity duration-500"
                      style={{ backgroundColor: `rgba(0, 0, 0, ${(displayTheme.backgroundDim !== undefined ? displayTheme.backgroundDim : 40) / 100})` }}
                    />
                    {displayTheme.enableVignette && (
                      <div
                        className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-500"
                        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.75) 100%)' }}
                      />
                    )}

                    {/* Judul (Header) & Konten sama persis dengan ControlPanel & DisplayWindow */}
                    {(() => {
                      const segmentIndex = activeSegment !== null ? activeSegment : 0;
                      let label = (selectedItem.segmentLabels && selectedItem.segmentLabels[segmentIndex]) ? selectedItem.segmentLabels[segmentIndex] : '';
                      const hasBook = !!(selectedItem as any).book;
                      if (!label && (selectedItem.type === 'song' || hasBook)) {
                        if (hasBook) {
                          const match = selectedItem.title.match(/(.+?)\s*:\s*(\d+)/);
                          if (match) {
                            label = `Ayat ${parseInt(match[2], 10) + segmentIndex}`;
                          } else {
                            label = `Ayat ${segmentIndex + 1}`;
                          }
                        } else {
                          label = selectedItem.segments.length > 1 ? `Bait ${segmentIndex + 1}` : '•';
                        }
                      }
                      if (selectedItem.type === 'song' && label.startsWith('Slide ')) {
                        label = label.replace('Slide ', 'Bait ');
                      }
                      const isJudulSlide = label.toLowerCase() === 'judul';

                      return (
                        <>
                          {selectedItem.title && selectedItem.type !== 'video' && !isJudulSlide && !selectedItem.hideHeaderTitle && (
                            <h2
                              className="absolute left-0 right-0 w-full px-4 text-center font-heading font-bold text-yellow-300 opacity-90 tracking-wider z-20 transition-all duration-500"
                              style={{
                                top: `${6 + (displayTheme.titleOffsetY ?? 0)}%`,
                                fontSize: `${1.5 + (displayTheme.headerTitleFontSizeOffset !== undefined ? displayTheme.headerTitleFontSizeOffset : 0.5) + (selectedItem.headerTitleFontSizeOffset || 0)}cqw`,
                                textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
                              }}
                            >
                              {selectedItem.title}
                            </h2>
                          )}

                          {/* Konten Slide Preview (Safe Area & Sizing 100% Cocok dengan ControlPanel & Proyektor) */}
                          <div
                            className={`absolute left-0 right-0 z-10 flex flex-col items-center w-full min-h-0 transition-all duration-700 ${(displayTheme.position || 'center') === 'top' ? 'top-[8%] bottom-[12%] justify-start' :
                              (displayTheme.position || 'center') === 'bottom' ? 'top-[18%] bottom-[8%] justify-end' :
                                'top-[18%] bottom-[12%] justify-center'
                              }`}
                            style={{
                              paddingLeft: `${displayTheme.paddingHorizontal ?? 8}%`,
                              paddingRight: `${displayTheme.paddingHorizontal ?? 8}%`,
                              marginTop: `${displayTheme.contentOffsetY ?? 0}%`
                            }}
                          >
                            <div
                              className={`text-center whitespace-pre-wrap drop-shadow-xl w-full ${displayTheme.bold !== false ? 'font-bold' : 'font-medium'}`}
                              style={{
                                lineHeight: displayTheme.lineHeight ? Math.min(1.25, Math.max(1.12, Number(displayTheme.lineHeight))) : 1.16,
                                color: displayTheme.color || 'white',
                                textShadow: (displayTheme.shadow || 'dark') === 'dark'
                                  ? '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 0 4px 10px rgba(0,0,0,0.8)'
                                  : (displayTheme.shadow === 'light')
                                    ? '1px 1px 2px #fff, -1px -1px 2px #fff, 1px -1px 2px #fff, -1px 1px 2px #fff, 0 4px 10px rgba(255,255,255,0.8)'
                                    : 'none',
                                fontSize: `${calculateOptimalFontSize(selectedItem.segments[segmentIndex] || '', {
                                  is2Column: (selectedItem.segments[segmentIndex] || '').includes('\n[kuning]') || (selectedItem.segments[segmentIndex] || '').includes('\n[kolom2]'),
                                  isLowerThird: displayTheme.layout === 'lower-third',
                                  lineHeight: Number(displayTheme.lineHeight) || 1.16,
                                  fontSizeOffset: displayTheme.fontSizeOffset || 0
                                })}cqw`
                              }}
                              dangerouslySetInnerHTML={{ __html: processPreviewText(selectedItem.segments[segmentIndex] || '') }}
                            />

                            {/* Bait Label */}
                            {selectedItem.type !== 'video' && !isJudulSlide && (
                              <div
                                className="text-yellow-300 font-bold mt-[1.5cqw] tracking-widest uppercase opacity-80 animate-fade-in"
                                style={{
                                  fontSize: '1.5cqw',
                                  textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 10px rgba(0,0,0,0.9)',
                                  minHeight: '2cqw'
                                }}
                              >
                                {label || (selectedItem.type === 'song' ? '•' : '')}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-indigo-50 dark:bg-slate-800/50 p-4 rounded-xl text-sm text-indigo-900/70 dark:text-slate-400 border border-indigo-100 dark:border-white/10">
                    <p><strong>Tips:</strong> Preview ini menampilkan teks secara proporsional. Pecah baris lirik/ayat jika dirasa terlalu panjang agar jemaat dapat membacanya dengan jelas.</p>
                  </div>
                </div>
              </div>

              {activeSegment !== null && selectedItem.segments.length > 1 && (
                <div className="flex justify-center gap-4 sticky bottom-0 py-4 pointer-events-none z-50">
                  <button onClick={handlePrev} className="pointer-events-auto shadow-xl bg-white text-indigo-900 flex items-center gap-3 px-6 py-3 rounded-full font-bold hover:bg-gray-50 transition"><ArrowLeft size={18} /> Prev</button>
                  <button onClick={handleNext} className="pointer-events-auto shadow-xl bg-indigo-600 text-white flex items-center gap-3 px-6 py-3 rounded-full font-bold shadow-indigo-600/30 hover:bg-indigo-700 transition">Next <ArrowRight size={18} /></button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-indigo-900/40 dark:text-[#C5A059]/60">
              <BookOpen size={48} className="mb-4 opacity-50 dark:opacity-100" />
              <p className="text-lg font-medium opacity-100">Pilih item dari panel kiri untuk melihat isi detailnya.</p>
            </div>
          )}
        </section>
      </main>

      {/* DATABASE MANAGER MODAL */}
      {isDbManagerOpen && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex justify-center items-center p-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-2xl w-full border border-white/40 dark:border-white/10 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-indigo-900 dark:text-[#D4B872] flex items-center gap-2">
                <Settings size={20} /> Database Manager
              </h2>
              <button
                onClick={() => {
                  setIsDbManagerOpen(false);
                  setUploadFile(null);
                  setUploadDbName('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-2 text-indigo-900/50 hover:text-indigo-900 hover:bg-indigo-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-5">
              <div className="bg-indigo-50/70 dark:bg-slate-800/70 p-4 rounded-xl border border-indigo-100 dark:border-white/10">
                <h3 className="font-bold text-indigo-900 dark:text-[#D4B872] mb-3 flex items-center gap-2">
                  <Upload size={18} /> Unggah Versi Baru (.tsv / .json)
                </h3>

                <div className="flex flex-col gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-900/70 dark:text-[#C5A059]/80 mb-1">
                      Tipe Database:
                    </label>
                    <select
                      value={uploadDbType}
                      onChange={(e) => setUploadDbType(e.target.value as 'song' | 'bible')}
                      className="glass-input !py-2 !text-sm w-full"
                    >
                      <option value="song" className="dark:bg-[#0A1128] dark:text-[#C5A059]">Lagu</option>
                      <option value="bible" className="dark:bg-[#0A1128] dark:text-[#C5A059]">Alkitab</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-indigo-900/70 dark:text-[#C5A059]/80 mb-1">
                      Nama Versi (mis: KJV, NKB, Lagu Sion):
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nama versi database..."
                      value={uploadDbName}
                      onChange={(e) => setUploadDbName(e.target.value)}
                      className="glass-input !py-2 !text-sm w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-indigo-900/70 dark:text-[#C5A059]/80 mb-1">
                      Pilih File (.tsv atau .json):
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".tsv,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          if (!uploadDbName.trim()) {
                            const suggestedName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
                            setUploadDbName(suggestedName);
                          }
                        }
                      }}
                      className="w-full text-sm text-indigo-900 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 dark:file:bg-indigo-900/40 file:text-indigo-700 dark:file:text-indigo-400 hover:file:bg-indigo-200 dark:hover:file:bg-indigo-900/60 cursor-pointer"
                    />
                  </div>
                </div>

                {uploadFile && (
                  <div className="flex items-center justify-between p-2.5 mb-3 bg-white/80 dark:bg-slate-900/80 border border-indigo-200 dark:border-white/10 rounded-lg text-xs">
                    <div className="flex items-center gap-2 truncate">
                      {uploadFile.name.endsWith('.json') ? (
                        <FileCode size={16} className="text-amber-500 shrink-0" />
                      ) : (
                        <FileText size={16} className="text-blue-500 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{uploadFile.name}</span>
                      <span className="text-slate-400 shrink-0">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-red-500 transition"
                      title="Batalkan file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isUploadingDb || !uploadFile || !uploadDbName.trim()}
                  onClick={handleProcessUpload}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md ${isUploadingDb || !uploadFile || !uploadDbName.trim()
                      ? 'bg-slate-200 dark:bg-slate-700/50 text-slate-400 cursor-not-allowed border border-transparent'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-[#D4B872] dark:hover:bg-[#C5A059] dark:text-[#0A1128] shadow-indigo-500/20 active:scale-[0.99]'
                    }`}
                >
                  {isUploadingDb ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Sedang Memproses Database...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Proses Unggah Database</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <h3 className="font-bold text-indigo-900 dark:text-[#D4B872] mb-3">Database Terpasang</h3>
                <div className="space-y-2">
                  {dbList.map(db => (
                    <div key={db.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800/80 border border-indigo-100 dark:border-white/10 rounded-lg shadow-sm">
                      <div>
                        <div className="font-semibold text-indigo-900 dark:text-[#D4B872]">{db.name}</div>
                        <div className="text-xs text-indigo-500 dark:text-[#C5A059] uppercase tracking-wider">{db.type} • {db.isDefault ? 'Bawaan' : 'Kustom'}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {db.type === 'song' && (
                          <button
                            onClick={async () => {
                              if (confirm(`Cadangkan seluruh data ${db.name} ke Database Lokal?`)) {
                                try {
                                  const data = await get(`dbdata_${db.id}`);
                                  if (!data || !Array.isArray(data)) throw new Error("Data kosong");

                                  const res = await callApi('backupFullDatabase', {}, {
                                    method: 'POST',
                                    payload: { songs: data }
                                  });

                                  if (res && res.status === 'success') {
                                    alert("Pencadangan database lokal berhasil!");
                                  } else {
                                    alert("Gagal mencadangkan: " + (res?.message || 'Error'));
                                  }
                                } catch (err: any) {
                                  alert("Terjadi kesalahan: " + err.message);
                                }
                              }
                            }}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition"
                            title="Cadangkan ke Database Lokal"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5V19A9 3 0 0 0 21 19V5"></path><path d="M3 12A9 3 0 0 0 21 12"></path></svg>
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              const result = await exportDatabaseToTsv(db.id);
                              const blob = new Blob([result.content], { type: 'text/tab-separated-values' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${result.name}_Exported.tsv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (err: any) {
                              alert("Gagal mengexport TSV: " + err.message);
                            }
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition flex items-center gap-1 border border-indigo-200 dark:border-indigo-800/40"
                          title="Export ke TSV"
                        >
                          <Download size={13} /> TSV
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const result = await exportDatabaseToJson(db.id);
                              const blob = new Blob([result.content], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${result.name}_Exported.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (err: any) {
                              alert("Gagal mengexport JSON: " + err.message);
                            }
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition flex items-center gap-1 border border-amber-200 dark:border-amber-800/40"
                          title="Export ke JSON"
                        >
                          <Download size={13} /> JSON
                        </button>
                        {!db.isDefault && (
                          <button
                            disabled={processingId === db.id}
                            onClick={async () => {
                              if (confirm(`Hapus database ${db.name}?`)) {
                                setProcessingId(db.id);
                                try {
                                  await deleteDatabase(db.id);
                                  const list = await getDatabaseList();
                                  setDbList(list);

                                  // Auto-revert to default if the deleted version was currently active
                                  if (db.type === 'song' && selectedSongVersion === db.id) {
                                    setSelectedSongVersion('song_LSEB');
                                    setSelectedSongCategory('Semua');
                                  } else if (db.type === 'bible' && selectedBibleVersion === db.id) {
                                    setSelectedBibleVersion('bible_TB');
                                  }
                                } finally {
                                  setProcessingId(null);
                                }
                              }
                            }}
                            className={`p-2 rounded-lg transition ${processingId === db.id ? 'text-slate-400' : 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                            title="Hapus Database"
                          >
                            {processingId === db.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
