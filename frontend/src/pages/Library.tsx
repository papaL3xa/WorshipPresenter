import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2, Music, BookOpen, Edit, Save, Trash2, X, ArrowLeft, ArrowRight, Monitor } from 'lucide-react';
import { callApi } from '../api';
import { splitLongSegments } from '../utils/textSplitter';
import { useNavigate, useLocation } from 'react-router-dom';

const bibleBooks = [
  "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan",
  "Yosua", "Hakim-hakim", "Rut", "1 Samuel", "2 Samuel",
  "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh", "Ezra",
  "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal",
  "Pengkhotbah", "Kidung Agung", "Yesaya", "Yeremia", "Ratapan",
  "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos",
  "Obaja", "Yunus", "Mikha", "Nahum", "Habakuk",
  "Zefanya", "Hagai", "Zakharia", "Maleakhi",
  "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul",
  "Roma", "1 Korintus", "2 Korintus", "Galatia", "Efesus",
  "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius",
  "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus",
  "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes", "3 Yohanes",
  "Yudas", "Wahyu"
];

interface SearchResult {
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
  const [dragSegmentIdx, setDragSegmentIdx] = useState<number | null>(null);
  const lastSearchedRef = useRef({ query: '', type: '' });

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
      lastSearchedRef.current = { query: '', type: '' };
      return;
    }
    
    if (lastSearchedRef.current.query === query && lastSearchedRef.current.type === type && !autoSelectFirst) {
      return;
    }
    
    lastSearchedRef.current = { query, type };
    setIsSearching(true);
    
    if (!autoSelectFirst) {
      setSelectedItem(null);
      setSelectedResultIds([]);
      setActiveSegment(null);
      setIsEditingItem(false);
    }

    try {
      const endpoint = type === 'song' ? 'searchSongs' : 'searchBible';
      const res = await callApi(endpoint, { q: query });
      if (res.success) {
        const processedData = splitLongSegments(res.data);
        setResults(processedData);
        if (autoSelectFirst && processedData && processedData.length > 0) {
          setSelectedResultIds([processedData[0].id]);
        }
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
        performSearch(searchQuery, searchType);
      } else {
        setResults([]);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, searchType);
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
    if (selectedItem.type !== 'song') {
      alert('Maaf, saat ini hanya data Lagu yang bisa disimpan secara permanen ke database.');
      setIsEditingItem(false);
      return;
    }
    
    setIsSavingItem(true);
    try {
      const res = await callApi('saveSongItem', {}, { method: 'POST', payload: selectedItem });
      if (res.success) {
        setIsEditingItem(false);
        // Perbarui data di cache jika diperlukan, atau sekadar menampilkan notifikasi
      } else {
        alert('Gagal menyimpan: ' + (res.error?.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error saat menyimpan ke server');
    } finally {
      setIsSavingItem(false);
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
    <div className="h-screen p-4 flex flex-col gap-4">
      <header className="glass-panel p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900 flex items-center gap-2">
            <ArrowLeft size={16}/> Kembali
          </button>
          <h1 className="text-xl font-bold text-indigo-900">Library (Database)</h1>
        </div>
        <div className="flex items-center">
          <button onClick={() => window.open('#/display', '_blank', 'width=1280,height=720')} className="glass-button text-indigo-900 flex items-center gap-2">
            <Monitor size={16}/> Buka Display
          </button>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        <section className="w-full h-[45%] md:h-auto md:w-1/3 glass-panel p-4 flex flex-col">
          <h2 className="text-lg font-bold text-indigo-900 mb-4">Pencarian Data</h2>
          
          <div className="flex gap-2 mb-4">
            <button onClick={() => {setSearchType('song'); setResults([]); setSelectedItem(null); setSelectedResultIds([]);}} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'song' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/30 text-indigo-900'}`}><Music size={16}/> Lagu</button>
            <button onClick={() => {setSearchType('bible'); setResults([]); setSelectedItem(null); setSelectedResultIds([]);}} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'bible' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/30 text-indigo-900'}`}><BookOpen size={16}/> Alkitab</button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
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

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {results.map((res) => (
              <button 
                key={res.id} 
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
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selectedResultIds.includes(res.id) 
                    ? 'bg-white/60 border-indigo-500/50 shadow-sm ring-1 ring-indigo-500' 
                    : 'bg-white/40 border-white/20 hover:bg-white/60'
                }`}
              >
                <div className="font-semibold text-indigo-900">{res.title}</div>
                <div className="text-xs text-indigo-800/60 line-clamp-1">{res.segments[0]}</div>
              </button>
            ))}
            {results.length === 0 && !isSearching && searchQuery !== '' && (
              <div className="text-center text-sm text-indigo-900/60 p-4">Tidak ada hasil ditemukan.</div>
            )}
            {results.length === 0 && !isSearching && searchQuery === '' && (
              <div className="p-1">
                {searchType === 'song' ? (
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({length: 525}, (_, i) => i + 1).map(num => (
                      <button 
                        key={num}
                        onClick={() => {
                          setSearchQuery(num.toString());
                          performSearch(num.toString(), 'song', true);
                          document.getElementById('searchInputBox')?.focus();
                        }}
                        className="py-2 px-1 text-center text-xs font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition shadow-sm"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {bibleBooks.map(book => (
                      <button 
                        key={book}
                        onClick={() => {
                          setSearchQuery(book + " ");
                          // Do not auto select bible books because they still need to type the verse number
                          document.getElementById('searchInputBox')?.focus();
                        }}
                        className="p-2 text-left text-xs font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition line-clamp-1 shadow-sm"
                      >
                        {book}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="flex-1 glass-panel p-6 flex flex-col overflow-y-auto">
          {selectedItem ? (
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-900 mb-2">{selectedItem.title}</h2>
                  <div className="flex items-center gap-3">
                    <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded-full">
                      {selectedItem.type === 'song' ? 'Lagu Sion' : 'Alkitab (TB)'}
                    </div>
                    {selectedItem.author && selectedItem.author !== 'N/A' && (
                      <div className="text-sm font-semibold text-indigo-900/60 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                        {selectedItem.author}
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (isEditingItem) {
                      handleSaveItem();
                    } else {
                      setIsEditingItem(true);
                    }
                  }}
                  disabled={isSavingItem}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
                    isEditingItem ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'glass-button text-indigo-900'
                  } ${isSavingItem ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSavingItem ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : (isEditingItem ? <><Save size={16} /> Simpan ke Database</> : <><Edit size={16} /> Edit Lirik/Slide</>)}
                </button>
              </div>
              
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
                        <button 
                          onClick={() => {
                            const newItem = { ...selectedItem };
                            newItem.segments.splice(idx, 1);
                            if (newItem.segmentLabels) newItem.segmentLabels.splice(idx, 1);
                            setSelectedItem(newItem);
                          }}
                          className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {isEditingItem ? (
                      <textarea 
                        value={seg}
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
              
              {activeSegment !== null && selectedItem.segments.length > 1 && (
                <div className="flex justify-center gap-4 sticky bottom-0 py-4 pointer-events-none z-50">
                  <button onClick={handlePrev} className="pointer-events-auto shadow-xl bg-white text-indigo-900 flex items-center gap-3 px-6 py-3 rounded-full font-bold hover:bg-gray-50 transition"><ArrowLeft size={18}/> Prev</button>
                  <button onClick={handleNext} className="pointer-events-auto shadow-xl bg-indigo-600 text-white flex items-center gap-3 px-6 py-3 rounded-full font-bold shadow-indigo-600/30 hover:bg-indigo-700 transition">Next <ArrowRight size={18}/></button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-indigo-900/40">
              <BookOpen size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">Pilih item dari panel kiri untuk melihat isi detailnya.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
