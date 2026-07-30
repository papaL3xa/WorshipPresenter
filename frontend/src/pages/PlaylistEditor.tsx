import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Save, Trash2, ArrowUp, ArrowDown, FileText, Music, BookOpen, Loader2, CheckCircle, Edit3, Settings, CheckSquare, RefreshCw, X } from 'lucide-react';
import { callApi } from '../api';
import { SyncButton } from '../components/SyncButton';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  segments: string[];
  originalSegments?: string[];
  originalSegmentLabels?: string[];
  visibleSegments?: number[];
  refId?: string;
}

export default function PlaylistEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const editId = searchParams.get('id');
  
  const [playlistName, setPlaylistName] = useState('Ibadah Umum');
  const [playlistDate, setPlaylistDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [rundown, setRundown] = useState<SearchResult[]>([]);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'song'|'bible'>('song');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editId);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [customTextTitle, setCustomTextTitle] = useState('Pengumuman / Teks Bebas');
  const [customTextValue, setCustomTextValue] = useState('');
  const [editingCustomTextIndex, setEditingCustomTextIndex] = useState<number | null>(null);

  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [segmentEditIndex, setSegmentEditIndex] = useState<number | null>(null);
  const [tempVisibleSegments, setTempVisibleSegments] = useState<number[]>([]);

  const [isUploadingSlides, setIsUploadingSlides] = useState(false);

  useEffect(() => {
    if (editId) {
      callApi('getPlaylistItems', { id: editId }).then(res => {
        if (res.success && res.data) {
          setPlaylistName(res.data.name);
          if (res.data.date) setPlaylistDate(res.data.date.split('T')[0]);
          if (res.data.items) {
             const loadedItems = res.data.items.map((item: any) => ({
                id: item.type === 'announcement' ? 'custom-' + Date.now() : (item.refId || item.id),
                type: item.type,
                title: item.title,
                segments: item.segments,
                originalSegments: item.originalSegments || item.segments,
                originalSegmentLabels: item.originalSegmentLabels,
                visibleSegments: item.visibleSegments,
                localId: Math.random().toString(36).substr(2, 9)
             }));
             setRundown(loadedItems);
          }
        }
      }).catch(err => {
        console.error("Gagal load playlist", err);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [editId]);

  const performSearch = async (query: string, type: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const endpoint = type === 'song' ? 'searchSongs' : 'searchBible';
      const res = await callApi(endpoint, { q: query });
      if (res.success) {
        setSearchResults(res.data);
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
        setSearchResults([]);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, searchType);
  };

  const addToRundown = (item: SearchResult) => {
    const newItem = { 
      ...item, 
      localId: Math.random().toString(36).substr(2, 9),
      originalSegments: item.segments,
      visibleSegments: item.segments.map((_, i) => i) 
    };
    if (replaceIndex !== null) {
      const newR = [...rundown];
      newR[replaceIndex] = newItem as any;
      setRundown(newR);
      setReplaceIndex(null);
    } else {
      setRundown([...rundown, newItem as any]);
    }
  };

  const addCustomText = () => {
    setEditingCustomTextIndex(null);
    setCustomTextValue(''); 
    setCustomTextTitle('Pengumuman / Teks Bebas');
    setIsTextModalOpen(true);
  };

  const editCustomText = (index: number) => {
    setEditingCustomTextIndex(index);
    setCustomTextValue(rundown[index].segments[0]);
    setCustomTextTitle(rundown[index].title || 'Pengumuman / Teks Bebas');
    setIsTextModalOpen(true);
  };

  const handleSaveCustomText = () => {
    if (customTextValue.trim()) {
      const finalTitle = customTextTitle.trim() || 'Pengumuman / Teks Bebas';
      if (editingCustomTextIndex !== null) {
        const newR = [...rundown];
        newR[editingCustomTextIndex].segments = [customTextValue];
        newR[editingCustomTextIndex].title = finalTitle;
        setRundown(newR);
      } else if (replaceIndex !== null) {
        const newR = [...rundown];
        newR[replaceIndex] = {
          id: 'custom-' + Date.now(),
          type: 'announcement',
          title: finalTitle,
          segments: [customTextValue],
          localId: Math.random().toString(36).substr(2, 9)
        } as any;
        setRundown(newR);
        setReplaceIndex(null);
      } else {
        setRundown([...rundown, {
          id: 'custom-' + Date.now(),
          type: 'announcement',
          title: finalTitle,
          segments: [customTextValue],
          localId: Math.random().toString(36).substr(2, 9)
        } as any]);
      }
    }
    setIsTextModalOpen(false);
    setEditingCustomTextIndex(null);
  };

  const removeRundownItem = (index: number) => {
    const newR = [...rundown];
    newR.splice(index, 1);
    setRundown(newR);
  };

  const moveItem = (index: number, dir: number) => {
    if (index + dir < 0 || index + dir >= rundown.length) return;
    const newR = [...rundown];
    const temp = newR[index];
    newR[index] = newR[index + dir];
    newR[index + dir] = temp;
    setRundown(newR);
  };

  const openSegmentModal = (index: number) => {
    setSegmentEditIndex(index);
    setTempVisibleSegments(rundown[index].visibleSegments || []);
    setIsSegmentModalOpen(true);
  };

  const toggleSegment = (segIdx: number) => {
    setTempVisibleSegments(prev => 
      prev.includes(segIdx) ? prev.filter(i => i !== segIdx) : [...prev, segIdx].sort((a, b) => a - b)
    );
  };

  const saveSegmentSelection = () => {
    if (segmentEditIndex !== null) {
      const newR = [...rundown];
      newR[segmentEditIndex].visibleSegments = tempVisibleSegments;
      setRundown(newR);
    }
    setIsSegmentModalOpen(false);
    setSegmentEditIndex(null);
  };

  const handleSave = async () => {
    if (rundown.length === 0) return alert('Rundown masih kosong!');
    if (!playlistName) return alert('Nama playlist tidak boleh kosong');
    
    setIsSaving(true);
    const payload = {
      id: editId || undefined,
      name: playlistName,
      date: playlistDate,
      items: rundown.map((item) => {
        let customText = '';
        if (item.type === 'announcement') customText = item.segments[0];
        if (item.type === 'slideshow') customText = JSON.stringify(item.segments);
        if (item.type === 'song' || item.type === 'bible') customText = item.visibleSegments ? JSON.stringify(item.visibleSegments) : '';
        return {
          type: item.type,
          refId: item.type === 'announcement' ? item.title : (item.type === 'slideshow' ? null : (item.refId || item.id)),
          customText: customText
        };
      })
    };

    try {
      const res = await callApi('savePlaylist', {}, { method: 'POST', payload });
      if (res.success) {
        setIsSuccessModalOpen(true);
      } else {
        alert(res.error?.message || 'Gagal menyimpan');
      }
    } catch (err) {
      alert('Error saat menyimpan playlist');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!editId) return;
    setIsDeleteModalOpen(false);
    
    try {
      const res = await callApi('deletePlaylist', {}, { method: 'POST', payload: { id: editId } });
      if (res.success) {
        navigate('/dashboard');
      } else {
        alert('Gagal menghapus playlist');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploadingSlides(true);
    
    try {
      const promises = Array.from(files).map(file => {
        return new Promise<{name: string, mimeType: string, base64: string}>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const base64Full = ev.target?.result as string;
            const base64Data = base64Full.split(',')[1];
            resolve({
              name: file.name,
              mimeType: file.type,
              base64: base64Data
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
      
      const imagesData = await Promise.all(promises);
      
      const res = await callApi('uploadImages', {}, { method: 'POST', payload: { images: imagesData } });
      
      if (res.success && res.data && res.data.urls) {
        const newItem = {
          id: 'slideshow-' + Date.now(),
          type: 'slideshow',
          title: `Slideshow (${res.data.urls.length} Slide)`,
          segments: res.data.urls,
          localId: Math.random().toString(36).substr(2, 9)
        } as any;
        
        if (replaceIndex !== null) {
          const newR = [...rundown];
          newR[replaceIndex] = newItem;
          setRundown(newR);
          setReplaceIndex(null);
        } else {
          setRundown([...rundown, newItem]);
        }
      } else {
        alert("Gagal mengunggah gambar: " + (res.error?.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsUploadingSlides(false);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return <div className="h-screen flex justify-center items-center"><Loader2 className="animate-spin text-indigo-900" size={48} /></div>;
  }

  return (
    <div className="h-screen flex flex-col p-4 gap-4">
      <header className="glass-panel p-4 flex justify-between items-center shrink-0">
        <div className="flex gap-4 items-center">
          <input 
            type="text" 
            value={playlistName} 
            onChange={(e) => setPlaylistName(e.target.value)}
            className="glass-input text-xl font-bold text-indigo-900 w-64"
          />
          <input 
            type="date" 
            value={playlistDate} 
            onChange={(e) => setPlaylistDate(e.target.value)}
            className="glass-input text-indigo-900"
          />
        </div>
        <div className="flex gap-4 items-center">
          <SyncButton />
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900">Kembali</button>
          
          {editId && (
            <button 
              onClick={handleDelete} 
              className="glass-button bg-red-500/10 text-red-700 flex items-center gap-2 border-red-500/20 hover:bg-red-500/20"
            >
              <Trash2 size={16}/> Hapus
            </button>
          )}

          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="glass-button bg-green-500/30 text-green-900 flex items-center gap-2 border-green-500/30"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} 
            Simpan Playlist
          </button>
        </div>
      </header>

      <main className="flex-1 flex gap-4 min-h-0">
        <section className="flex-1 glass-panel p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
              <FileText size={20}/> Rundown Ibadah
            </h2>
            <div className="flex gap-2">
              <div className="relative">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  id="slideshow-upload"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <label 
                  htmlFor="slideshow-upload"
                  className={`glass-button text-sm py-1.5 cursor-pointer flex items-center gap-2 ${isUploadingSlides ? 'bg-indigo-200 text-indigo-500' : 'bg-indigo-500/20 text-indigo-900'}`}
                >
                  {isUploadingSlides ? <Loader2 size={14} className="animate-spin" /> : '+ Tambah Gambar / PPT'}
                </label>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {rundown.length === 0 ? (
              <div className="text-center p-8 text-indigo-900/50 border-2 border-dashed border-indigo-900/20 rounded-xl">
                Belum ada item di rundown.<br/>Cari dan tambahkan dari panel sebelah kanan.
              </div>
            ) : (
              rundown.map((item, idx) => (
                <div key={(item as any).localId} className="p-3 bg-white/40 border border-white/20 rounded-xl flex justify-between items-center group">
                  <div className="flex gap-3 items-center">
                    <span className="font-bold text-indigo-900/50 w-6">{idx + 1}.</span>
                    <div>
                      <div className="font-semibold text-indigo-900">{item.title}</div>
                      <div className="text-xs text-indigo-800/60 uppercase">{item.type} • {item.visibleSegments ? item.visibleSegments.length : item.segments.length} slide</div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.type === 'announcement' && (
                      <button onClick={() => editCustomText(idx)} className="p-2 hover:bg-white/50 rounded-lg text-indigo-900"><Edit3 size={16}/></button>
                    )}
                    {(item.type === 'song' || item.type === 'bible') && (
                      <button onClick={() => openSegmentModal(idx)} className="p-2 hover:bg-white/50 rounded-lg text-indigo-900" title="Atur Slide / Bait"><Settings size={16}/></button>
                    )}
                    <button onClick={() => setReplaceIndex(replaceIndex === idx ? null : idx)} className={`p-2 rounded-lg ${replaceIndex === idx ? 'bg-indigo-600 text-white' : 'hover:bg-white/50 text-indigo-900'}`} title="Ganti Item ini"><RefreshCw size={16}/></button>
                    <button onClick={() => moveItem(idx, -1)} className="p-2 hover:bg-white/50 rounded-lg text-indigo-900"><ArrowUp size={16}/></button>
                    <button onClick={() => moveItem(idx, 1)} className="p-2 hover:bg-white/50 rounded-lg text-indigo-900"><ArrowDown size={16}/></button>
                    <button onClick={() => removeRundownItem(idx)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-600"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="w-1/3 glass-panel p-4 flex flex-col">
          <h2 className="text-xl font-bold text-indigo-900 mb-4">Tambah Item</h2>
          
          {replaceIndex !== null && (
            <div className="bg-indigo-100 text-indigo-900 text-sm p-3 rounded-xl mb-4 border border-indigo-200 shadow-inner flex justify-between items-center">
              <span>Pilih item di bawah untuk mengganti: <strong>{rundown[replaceIndex]?.title}</strong></span>
              <button onClick={() => setReplaceIndex(null)} className="text-red-500 hover:bg-red-500/10 p-1 rounded"><X size={16}/></button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button onClick={() => setSearchType('song')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'song' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/30 text-indigo-900'}`}><Music size={16}/> Lagu</button>
            <button onClick={() => setSearchType('bible')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition ${searchType === 'bible' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/30 text-indigo-900'}`}><BookOpen size={16}/> Ayat</button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari ${searchType === 'song' ? 'Lagu' : 'Ayat'}...`} 
              className="glass-input flex-1"
            />
            <button type="submit" disabled={isSearching} className="glass-button bg-indigo-500/20 text-indigo-900 border-indigo-500/30">
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16}/>}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {searchResults.map((res) => (
              <div key={res.id} className="p-3 bg-white/40 border border-white/20 rounded-xl hover:bg-white/60 transition cursor-pointer flex justify-between items-center" onClick={() => addToRundown(res)}>
                <div>
                  <div className="font-semibold text-indigo-900">{res.title}</div>
                  <div className="text-xs text-indigo-800/60 line-clamp-1">{res.segments[0]}</div>
                </div>
                <div className="text-xl font-bold text-indigo-900/30">+</div>
              </div>
            ))}
            {searchResults.length === 0 && !isSearching && searchQuery !== '' && (
              <div className="text-center text-sm text-indigo-900/60 p-4">Tidak ada hasil ditemukan.</div>
            )}
          </div>

          <button onClick={addCustomText} className="glass-button w-full border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900">
            + Tambah Teks Bebas / Pengumuman
          </button>
        </section>
      </main>

      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-white/40 transform scale-100 transition-transform text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-indigo-900 mb-2">Berhasil!</h2>
            <p className="text-indigo-900/70 mb-8">
              Playlist <strong>"{playlistName}"</strong> telah berhasil disimpan.
            </p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      )}

      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-lg w-full border border-white/40">
            <h2 className="text-xl font-bold text-indigo-900 mb-4">Teks Bebas / Pengumuman</h2>
            <input 
              type="text" 
              value={customTextTitle}
              onChange={(e) => setCustomTextTitle(e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-indigo-900 mb-4 shadow-inner"
              placeholder="Judul"
            />
            <textarea 
              value={customTextValue}
              onChange={(e) => setCustomTextValue(e.target.value)}
              className="w-full h-40 bg-white border border-indigo-200 rounded-xl p-4 text-indigo-900 mb-6 resize-none shadow-inner"
              placeholder="Ketik teks di sini..."
              autoFocus
            ></textarea>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsTextModalOpen(false)} className="px-6 py-2 rounded-xl font-bold text-indigo-900 bg-black/5">Batal</button>
              <button onClick={handleSaveCustomText} className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-white/40 text-center">
            <h2 className="text-2xl font-bold text-indigo-900 mb-4">Hapus Playlist?</h2>
            <div className="flex gap-3 w-full justify-center">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-indigo-900 bg-black/5 flex-1">Batal</button>
              <button onClick={handleConfirmDelete} className="px-6 py-3 rounded-xl font-bold text-white bg-red-500 flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {isSegmentModalOpen && segmentEditIndex !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-white/40 flex flex-col max-h-[85vh]">
            <h2 className="text-2xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <CheckSquare size={24} /> Pilih Bait / Ayat
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 border border-indigo-100 rounded-xl p-3 bg-slate-50/50">
              {(rundown[segmentEditIndex].originalSegments || rundown[segmentEditIndex].segments).map((seg: string, i: number) => {
                const isChecked = tempVisibleSegments.includes(i);
                return (
                  <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${isChecked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                    <input type="checkbox" className="mt-1 w-4 h-4" checked={isChecked} onChange={() => toggleSegment(i)} />
                    <div className="text-sm">{seg}</div>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsSegmentModalOpen(false)} className="px-6 py-2 rounded-xl font-bold text-indigo-900 bg-black/5">Batal</button>
              <button onClick={saveSegmentSelection} className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600">Simpan Pilihan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
