import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2, Music, BookOpen, Edit, Save, Trash2, X, ArrowLeft, ArrowRight, Monitor, Star, Copy, Settings, Download } from 'lucide-react';
import { callApi } from '../api';
import { FooterClock } from '../components/FooterClock';
import { splitLongSegments } from '../utils/textSplitter';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFavorites } from '../hooks/useFavorites';
import { SyncButton } from '../components/SyncButton';
import { initDefaultDatabases, searchLocalSongs, searchLocalBible, getDatabaseList, DatabaseVersion, getAllLocalSongTitles, deleteDatabase, addCustomDatabase, syncCustomSongs, exportDatabaseToTsv, getBibleBookMetadata, getBibleChapterMetadata, getBibleBooksList, getLocalSongCategories } from '../utils/dbStorage';
import { get, set } from 'idb-keyval';

// bibleBooks array removed, fetched dynamically from database instead

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  author?: string;
  segments: string[];
  segmentLabels?: string[];
}

export default function Library() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<'song'|'bible'>('song');
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
  const [allSongTitles, setAllSongTitles] = useState<{id: string, title: string}[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [dbList, setDbList] = useState<DatabaseVersion[]>([]);
  const [selectedSongVersion, setSelectedSongVersion] = useState('song_LSEB');
  const [selectedBibleVersion, setSelectedBibleVersion] = useState('bible_TB');
  const [isDbManagerOpen, setIsDbManagerOpen] = useState(false);
  const [selectedSongCategory, setSelectedSongCategory] = useState<string>('Semua');
  const [songCategories, setSongCategories] = useState<string[]>(['Semua']);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Bible Progressive Navigation State
  const [currentBibleBooks, setCurrentBibleBooks] = useState<string[]>([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState<string | null>(null);
  const [selectedBibleChapter, setSelectedBibleChapter] = useState<number | null>(null);
  const [bibleChaptersCount, setBibleChaptersCount] = useState<number>(0);
  const [bibleVersesCount, setBibleVersesCount] = useState<number>(0);
  const [isLoadingBibleMeta, setIsLoadingBibleMeta] = useState(false);

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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const performSearch = async (query: string, type: string, autoSelectFirst = false) => {
    if (!query || query.trim().length === 0) {
      setResults([]);
      lastSearchedRef.current = { query: '', type: '', songVersion: '', bibleVersion: '', songCategory: '' };
      return;
    }
    
    if (lastSearchedRef.current.query === query && 
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
        resultsData = res.slice(0, 100).map((item: any) => ({ ...item, type: 'song' }));
      } else {
        const res = await searchLocalBible(query, selectedBibleVersion);
        resultsData = res.map((item: any, idx: number) => ({
          id: item.isRange ? item.id : `b_${idx}`,
          type: 'bible',
          title: item.isRange ? item.title : `${item.book} ${item.chapter}:${item.verse}`,
          author: 'Alkitab',
          category: 'Alkitab',
          segments: item.isRange ? item.segments : [item.text],
          segmentOrder: item.isRange ? item.segments.map((_:any, i:number) => i) : [0]
        }));
      }
      
      let processedData = splitLongSegments(resultsData);
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
      if (searchQuery.trim().length > 0) {
        if (!showFavorites) {
          performSearch(searchQuery, searchType);
        } else {
          setResults(favorites.filter(f => f.type === searchType && (searchQuery ? f.title.toLowerCase().includes(searchQuery.toLowerCase()) : true)));
        }
      } else {
        if (showFavorites) {
          setResults(favorites.filter(f => f.type === searchType));
        } else {
          setResults([]);
        }
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
        const processed = splitLongSegments([{...exact, type: 'song'}])[0];
        setSelectedItem(JSON.parse(JSON.stringify(processed)));
        setSelectedResultIds([processed.id]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedResultIds.length === 0) {
      setSelectedItem(null);
      return;
    }
    
    // Sort selected items according to their original order in `results`
    const selectedItemsList = results.filter(r => selectedResultIds.includes(r.id));
    if (selectedItemsList.length === 0) return;
    
    if (selectedItemsList.length === 1) {
      setSelectedItem(JSON.parse(JSON.stringify(selectedItemsList[0])));
      return;
    }

    if (searchType === 'bible') {
       const combinedSegments = selectedItemsList.map(r => r.segments[0]);
       const combinedLabels = selectedItemsList.map(r => r.title);
       const firstTitle = selectedItemsList[0].title;
       const lastTitle = selectedItemsList[selectedItemsList.length - 1].title;
       
       setSelectedItem({
         id: selectedItemsList.map(r => r.id).join('_'),
         type: 'bible',
         title: `${firstTitle} - ${lastTitle.split(' ').pop()}`,
         segments: combinedSegments,
         segmentLabels: combinedLabels
       });
    } else {
       // Fallback for song (only show first selected)
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
    
    // Ensure selectedItem has the correct type before saving
    selectedItem.type = 'song';
    
    setIsSavingItem(true);
    try {
      const res = await callApi('saveSongItem', {}, { method: 'POST', payload: selectedItem });
      if (res.success) {
        // Optimistic local update
        const currentSync = (await get('dbdata_song_GAS_SYNC')) || [];
        const existingIdx = currentSync.findIndex((s: any) => s.id === selectedItem.id);
        if (existingIdx >= 0) {
           currentSync[existingIdx] = selectedItem;
        } else {
           currentSync.push(selectedItem);
        }
        await set('dbdata_song_GAS_SYNC', currentSync);

        setIsEditingItem(false);
        await syncCustomSongs(); // Sync local cache with backend
        
        // Refresh local views
        if (searchType === 'song') {
          const newTitles = await getAllLocalSongTitles(selectedSongVersion);
          if (Array.isArray(newTitles)) setAllSongTitles(newTitles);
          
          if (searchQuery !== '') {
            const newRes = await searchLocalSongs(searchQuery, selectedSongVersion);
            setResults(newRes);
          }
        }
      } else {
        alert('Gagal menyimpan: ' + (res.error?.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error saat menyimpan ke server');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!selectedItem || !selectedItem.id) return;
    if (!confirm('Anda yakin ingin menghapus lagu ini secara permanen?')) return;
    
    setIsDeletingSong(true);
    try {
      const res = await callApi('deleteSongItem', {}, { method: 'POST', payload: { id: selectedItem.id } });
      if (res && res.status === 'deleted') {
        const currentSync = await get('dbdata_song_GAS_SYNC') || [];
        const filteredSync = currentSync.filter((s: any) => s.id !== selectedItem.id);
        await set('dbdata_song_GAS_SYNC', filteredSync);
        
        setSelectedItem(null);
        setIsEditingItem(false);
        
        // Panggil pencarian ulang dengan state lama untuk update daftar
        // Karena kita mengubah IndexedDB di background, pencarian ulang akan mengambil data baru
        if (lastSearchedRef.current.query) {
          const resSearch = await searchLocalSongs(lastSearchedRef.current.query, selectedSongVersion);
          setResults(resSearch.slice(0, 100).map((item: any) => ({ ...item, type: 'song' })));
        } else {
          setResults([]);
        }
        
        // Refresh daftar judul agar Grid view (saat query kosong) juga terupdate
        const newTitles = await getAllLocalSongTitles(selectedSongVersion);
        if (Array.isArray(newTitles)) setAllSongTitles(newTitles);
      } else {
        alert('Gagal menghapus lagu: ' + (res?.message || 'Error'));
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menghubungi server untuk menghapus lagu');
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

  return (
    <div className="h-full p-4 flex flex-col gap-4">
      <header className="glass-panel p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900 flex items-center gap-2">
            <ArrowLeft size={16}/> Kembali
          </button>
          <h1 className="text-xl font-bold text-indigo-900 ml-2">Library (Database)</h1>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton />
          <button onClick={() => window.open('#/display', '_blank', 'width=1280,height=720')} className="glass-button text-indigo-900 flex items-center gap-2">
            <Monitor size={16}/> Buka Display
          </button>
        </div>
      </header>
      
      <FooterClock />
      
      <main className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        <section className="w-full h-[45%] md:h-auto md:w-1/3 glass-panel p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-indigo-900">Pencarian Data</h2>
            {searchType === 'song' && (
              <button 
                onClick={() => {
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
                className="p-1.5 rounded-lg transition-all shadow-sm font-semibold bg-green-500/10 text-green-700 border border-green-500/30 hover:bg-green-500/20"
                title="Tambah Lagu Baru"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          
          <div className="flex gap-2 mb-2">
            <button onClick={() => {setSearchType('song'); setResults([]); setSelectedItem(null); setSelectedResultIds([]);}} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'song' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/30 text-indigo-900'}`}><Music size={16}/> Lagu</button>
            <button onClick={() => {
              setSearchType('bible'); 
              setResults([]); 
              setSelectedItem(null); 
              setSelectedResultIds([]);
              setSelectedBibleBook(null);
              setSelectedBibleChapter(null);
            }} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'bible' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/30 text-indigo-900'}`}><BookOpen size={16}/> Alkitab</button>
          </div>
          
          <div className="mb-4 flex gap-2">
            <select 
              className="flex-1 bg-white/50 border border-indigo-200 rounded-lg px-2 py-2 text-sm text-indigo-900 font-semibold focus:outline-none focus:border-indigo-500 transition"
              value={searchType === 'song' ? selectedSongVersion : selectedBibleVersion}
              onChange={(e) => searchType === 'song' ? setSelectedSongVersion(e.target.value) : setSelectedBibleVersion(e.target.value)}
            >
              {dbList.filter(d => d.type === searchType).map(db => (
                <option key={db.id} value={db.id}>{db.name}</option>
              ))}
            </select>
            <button 
              onClick={() => setIsDbManagerOpen(true)}
              className="p-2 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition shadow-sm flex items-center justify-center"
              title="Kelola Database (Tambah Versi)"
            >
              <Settings size={18} />
            </button>
          </div>
          
          {searchType === 'song' && (
            <div className="mb-4">
              <select 
                className="w-full bg-white/50 border border-indigo-200 rounded-lg px-2 py-2 text-sm text-indigo-900 font-semibold focus:outline-none focus:border-indigo-500 transition"
                value={selectedSongCategory}
                onChange={(e) => setSelectedSongCategory(e.target.value)}
              >
                {songCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
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
              className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-sm border ${showFavorites ? 'bg-yellow-400 border-yellow-500 text-yellow-900 shadow-yellow-400/50 scale-105' : 'bg-white/40 border-white/40 text-indigo-900 hover:bg-white/60'}`}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-900/40 hover:text-indigo-900 transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button type="submit" disabled={isSearching} className="glass-button bg-indigo-500/20 text-indigo-900 border-indigo-500/30">
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16}/>}
            </button>
          </form>
          </div>
          
          {results.length === 0 && !isSearching && searchQuery === '' && searchType === 'song' && (
            <div className="flex justify-center gap-2 mb-3 shrink-0">
              <button onClick={() => setViewMode('grid')} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-900 border border-indigo-200'}`}>Nomor Saja</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-900 border border-indigo-200'}`}>Nomor & Judul</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {results.map((res) => (
              <div 
                key={res.id} 
                className={`w-full flex items-stretch rounded-xl border transition overflow-hidden ${
                  selectedResultIds.includes(res.id) 
                    ? 'bg-white/60 border-indigo-500/50 shadow-sm ring-1 ring-indigo-500' 
                    : 'bg-white/40 border-white/20 hover:bg-white/60'
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
                  <div className="font-semibold text-indigo-900">{res.title}</div>
                  <div className="text-xs text-indigo-800/60 line-clamp-1">{res.segments[0]}</div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(res);
                  }}
                  className="px-4 border-l border-white/20 flex items-center justify-center transition hover:bg-white/50"
                  title={isFavorite(res.id) ? "Hapus dari Favorit" : "Tambahkan ke Favorit"}
                >
                  <Star size={18} className={isFavorite(res.id) ? "text-yellow-500 stroke-[2.5px]" : "text-indigo-300"} />
                </button>
              </div>
            ))}
            {results.length === 0 && !isSearching && searchQuery !== '' && (
              <div className="text-center text-sm text-indigo-900/60 p-4">Tidak ada hasil ditemukan.</div>
            )}
            {results.length === 0 && !isSearching && searchQuery === '' && (
              <div className="p-1">
                {searchType === 'song' ? (
                  <>
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-5 gap-1.5">
                        {allSongTitles ? allSongTitles.map((song: any) => (
                          <button 
                            key={song.id}
                            onClick={() => {
                              handleQuickOpenSong(song.id.toString());
                            }}
                            className="py-2 px-1 text-center text-xs font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition shadow-sm overflow-hidden text-ellipsis whitespace-nowrap"
                            title={song.title}
                          >
                            {song.id}
                          </button>
                        )) : (
                          <div className="col-span-5 text-center p-4"><Loader2 size={20} className="animate-spin text-indigo-500 mx-auto"/></div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {allSongTitles ? allSongTitles.map((song: any) => (
                          <button 
                            key={song.id}
                            onClick={() => {
                              handleQuickOpenSong(song.id.toString());
                            }}
                            className="w-full overflow-hidden p-2 text-left text-sm font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition shadow-sm flex items-center gap-3"
                          >
                            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs min-w-[32px] text-center shrink-0">{song.id}</span>
                            <span className="line-clamp-1 break-all">{song.title}</span>
                          </button>
                        )) : (
                          <div className="text-center p-4"><Loader2 size={20} className="animate-spin text-indigo-500 mx-auto"/></div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col h-full">
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
                            className="p-2 text-left text-xs font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition line-clamp-1 shadow-sm"
                          >
                            {book}
                          </button>
                        )) : (
                          <div className="col-span-2 text-center p-4"><Loader2 size={24} className="animate-spin text-indigo-500 mx-auto"/></div>
                        )}
                      </div>
                    ) : !selectedBibleChapter ? (
                      <div className="flex flex-col">
                        <button 
                          onClick={() => setSelectedBibleBook(null)}
                          className="mb-3 w-full p-2 bg-indigo-100 text-indigo-900 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-200 transition font-bold shadow-sm"
                        >
                          <ArrowLeft size={16}/> Kembali ke Kitab
                        </button>
                        <div className="font-bold text-indigo-900 mb-2 text-center">{selectedBibleBook} - Pilih Pasal</div>
                        {isLoadingBibleMeta ? (
                          <div className="text-center p-4"><Loader2 size={24} className="animate-spin text-indigo-500 mx-auto"/></div>
                        ) : (
                          <div className="grid grid-cols-5 gap-1.5">
                            {Array.from({length: bibleChaptersCount}, (_, i) => i + 1).map(chap => (
                              <button
                                key={chap}
                                onClick={async () => {
                                  setSelectedBibleChapter(chap);
                                  setIsLoadingBibleMeta(true);
                                  const maxV = await getBibleChapterMetadata(selectedBibleVersion, selectedBibleBook, chap);
                                  setBibleVersesCount(maxV);
                                  setIsLoadingBibleMeta(false);
                                }}
                                className="py-2.5 text-center text-sm font-bold text-indigo-900 bg-white/60 border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-sm"
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
                          className="mb-3 w-full p-2 bg-indigo-100 text-indigo-900 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-200 transition font-bold shadow-sm"
                        >
                          <ArrowLeft size={16}/> Kembali ke Pasal
                        </button>
                        <div className="font-bold text-indigo-900 mb-2 text-center">{selectedBibleBook} {selectedBibleChapter} - Pilih Ayat</div>
                        {isLoadingBibleMeta ? (
                          <div className="text-center p-4"><Loader2 size={24} className="animate-spin text-indigo-500 mx-auto"/></div>
                        ) : (
                          <div className="grid grid-cols-5 gap-1.5">
                            {Array.from({length: bibleVersesCount}, (_, i) => i + 1).map(verse => (
                              <button
                                key={verse}
                                onClick={() => {
                                  const query = `${selectedBibleBook} ${selectedBibleChapter}:${verse}`;
                                  setSearchQuery(query);
                                  // Eksekusi pencarian secara langsung
                                  performSearch(query, 'bible');
                                }}
                                className="py-2.5 text-center text-sm font-bold text-indigo-900 bg-white/60 border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-sm"
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
                        onChange={(e) => setSelectedItem({...selectedItem, title: e.target.value})}
                        className="w-full text-2xl font-bold text-indigo-900 mb-2 bg-white border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Judul Lagu"
                      />
                      {selectedItem.type === 'song' && (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={selectedItem.id}
                            onChange={(e) => setSelectedItem({...selectedItem, id: e.target.value.replace(/\s+/g, '_')})}
                            className="w-1/3 text-sm font-semibold text-indigo-900 bg-indigo-50 border border-indigo-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Nomor/ID Lagu (tanpa spasi)"
                            title="Nomor atau ID Unik Lagu"
                          />
                          <input 
                            type="text" 
                            value={selectedItem.author || ''}
                            onChange={(e) => setSelectedItem({...selectedItem, author: e.target.value})}
                            className="w-2/3 text-sm font-semibold text-indigo-900/60 bg-white border border-indigo-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Pencipta Lagu"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-indigo-900 mb-2">{selectedItem.title}</h2>
                      <div className="flex items-center gap-3">
                        <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded-full">
                          {searchType === 'song' ? (dbList.find(db => db.id === selectedSongVersion)?.name || 'Lagu Sion') : 'Alkitab (TB)'}
                        </div>
                        {selectedItem.author && selectedItem.author !== 'N/A' && (
                          <div className="text-sm font-semibold text-indigo-900/60 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                            {selectedItem.author}
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
                  <button 
                    onClick={() => {
                      if (isEditingItem) {
                        handleSaveItem();
                      } else {
                        setIsEditingItem(true);
                      }
                    }}
                    disabled={isSavingItem || isDeletingSong}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
                      isEditingItem ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'glass-button text-indigo-900'
                    } ${isSavingItem || isDeletingSong ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    className={`w-full text-left p-4 rounded-lg border shadow-sm transition group relative overflow-hidden ${
                      activeSegment === idx 
                        ? 'bg-indigo-600 border-indigo-700' 
                        : 'bg-white/50 border-white/40 hover:bg-white/70'
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
                          className="bg-white border border-indigo-200 text-indigo-900 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded w-32"
                        />
                      ) : (
                        <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activeSegment === idx ? 'text-indigo-200' : 'text-indigo-400'}`}>
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
                        className="w-full h-24 bg-white border border-indigo-200 text-indigo-900 text-lg whitespace-pre-wrap leading-relaxed p-2 rounded focus:outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <div 
                        onClick={() => handlePresent(idx)}
                        className={`text-lg whitespace-pre-wrap leading-relaxed cursor-pointer ${activeSegment === idx ? 'text-white' : 'text-indigo-900'}`}
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
                className="w-full aspect-video bg-black rounded-xl overflow-hidden relative shadow-lg flex items-center justify-center p-4 md:p-6 border-[4px] md:border-[6px] border-slate-800"
                style={{
                  backgroundImage: localStorage.getItem('custom_bg') ? `url('${localStorage.getItem('custom_bg')}')` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <p className="text-white text-center font-bold whitespace-pre-wrap leading-relaxed drop-shadow-xl text-lg md:text-xl lg:text-2xl" 
                   style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
                  {activeSegment !== null ? selectedItem.segments[activeSegment] : "Pilih slide..."}
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-slate-800/50 p-4 rounded-xl text-sm text-indigo-900/70 dark:text-slate-400 border border-indigo-100 dark:border-white/10">
                <p><strong>Tips:</strong> Preview ini menampilkan teks secara proporsional. Pecah baris lirik/ayat jika dirasa terlalu panjang agar jemaat dapat membacanya dengan jelas.</p>
              </div>
            </div>
          </div>
              
              {activeSegment !== null && selectedItem.segments.length > 1 && (
                <div className="flex justify-center gap-4 sticky bottom-0 py-4 pointer-events-none z-50">
                  <button onClick={handlePrev} className="pointer-events-auto shadow-xl bg-white text-indigo-900 flex items-center gap-3 px-6 py-3 rounded-full font-bold hover:bg-gray-50 transition"><ArrowLeft size={18}/> Prev</button>
                  <button onClick={handleNext} className="pointer-events-auto shadow-xl bg-indigo-600 text-white flex items-center gap-3 px-6 py-3 rounded-full font-bold shadow-indigo-600/30 hover:bg-indigo-700 transition">Next <ArrowRight size={18}/></button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-indigo-900/40">
              <BookOpen size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">Pilih item dari panel kiri untuk melihat isi detailnya.</p>
            </div>
          )}
        </section>
      </main>
      
      {/* DATABASE MANAGER MODAL */}
      {isDbManagerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-2xl w-full border border-white/40 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Settings size={20} /> Database Manager
              </h2>
              <button onClick={() => setIsDbManagerOpen(false)} className="p-2 text-indigo-900/50 hover:text-indigo-900 hover:bg-indigo-100 rounded-lg transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-4">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <h3 className="font-bold text-indigo-900 mb-2">Unggah Versi Baru (.tsv)</h3>
                <div className="flex flex-col gap-3 mb-4">
                  <select id="newDbType" className="glass-input !py-2 !text-sm w-full">
                    <option value="song">Lagu</option>
                    <option value="bible">Alkitab</option>
                  </select>
                  <input id="newDbName" type="text" placeholder="Nama Versi (mis: KJV, NKB)" className="glass-input !py-2 !text-sm w-full" />
                </div>
                <input 
                  type="file" 
                  accept=".tsv"
                  onChange={async (e) => {
                    if (!e.target.files || e.target.files.length === 0) return;
                    const file = e.target.files[0];
                    const type = (document.getElementById('newDbType') as HTMLSelectElement).value as 'song'|'bible';
                    const name = (document.getElementById('newDbName') as HTMLInputElement).value;
                    
                    if (!name) {
                      alert("Silakan masukkan Nama Versi terlebih dahulu.");
                      return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      const text = evt.target?.result as string;
                      try {
                        const newId = `${type}_${Date.now()}`;
                        await addCustomDatabase({ id: newId, name, type }, text);
                        alert("Database berhasil ditambahkan!");
                        const list = await getDatabaseList();
                        setDbList(list);
                        
                        // Auto-select the newly added version
                        if (type === 'song') setSelectedSongVersion(newId);
                        else setSelectedBibleVersion(newId);
                        
                        // Reset category to "Semua" to prevent filtering out the new DB's songs
                        if (type === 'song') setSelectedSongCategory('Semua');
                        
                      } catch (err: any) {
                        alert("Gagal memproses file: " + err.message);
                      }
                    };
                    reader.readAsText(file);
                  }}
                  className="w-full text-sm text-indigo-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
                />
              </div>

              <div>
                <h3 className="font-bold text-indigo-900 mb-3">Database Terpasang</h3>
                <div className="space-y-2">
                  {dbList.map(db => (
                    <div key={db.id} className="flex justify-between items-center p-3 bg-white border border-indigo-100 rounded-lg shadow-sm">
                      <div>
                        <div className="font-semibold text-indigo-900">{db.name}</div>
                        <div className="text-xs text-indigo-500 uppercase tracking-wider">{db.type} • {db.isDefault ? 'Bawaan' : 'Kustom'}</div>
                      </div>
                      <div className="flex gap-2">
                        {db.type === 'song' && (
                          <button 
                            onClick={async () => {
                              if (confirm(`Backup seluruh data ${db.name} ke Cloud (Google Spreadsheet)? Ini akan menimpa data yang ada di Spreadsheet.`)) {
                                try {
                                  const data = await get(`dbdata_${db.id}`);
                                  if (!data || !Array.isArray(data)) throw new Error("Data kosong");
                                  
                                  const res = await callApi('backupFullDatabase', {}, {
                                    method: 'POST',
                                    payload: { songs: data }
                                  });
                                  
                                  if (res && res.status === 'success') {
                                    alert("Backup seluruh database berhasil tersimpan ke Cloud!");
                                  } else {
                                    alert("Gagal mem-backup: " + (res?.message || 'Error'));
                                  }
                                } catch (err: any) {
                                  alert("Terjadi kesalahan: " + err.message);
                                }
                              }
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="Backup Seluruh Isi Database ke Cloud"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg>
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
                              alert("Gagal mengexport: " + err.message);
                            }
                          }}
                          className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                          title="Export ke TSV"
                        >
                          <Download size={16} />
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
                            className={`p-2 rounded-lg transition ${processingId === db.id ? 'text-slate-400' : 'text-red-500 hover:bg-red-50'}`}
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
