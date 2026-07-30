import { useState, useEffect, useRef } from 'react';
import { Monitor, Square, ArrowRight, ArrowLeft, Loader2, Image as ImageIcon, Upload, CheckCircle, Type, Plus, Trash2, Edit, Save, Search, Music, BookOpen, Settings, CheckSquare, X, RefreshCw } from 'lucide-react';
import { callApi } from '../api';
import { SyncButton } from '../components/SyncButton';
import { splitLongSegments } from '../utils/textSplitter';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ControlPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const playlistId = searchParams.get('id');

  const [playlist, setPlaylist] = useState<any[]>([]);
  const [playlistName, setPlaylistName] = useState('Memuat...');
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeItem, setActiveItem] = useState(0);
  const [activeSegment, setActiveSegment] = useState(0);
  const [mode, setMode] = useState<'content' | 'blank' | 'logo'>('content');
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isRunningTextModalOpen, setIsRunningTextModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [logoPos, setLogoPos] = useState(localStorage.getItem('worship_logo_position') || 'bottom-right');
  
  // Edit Rundown States
  const [isEditingRundown, setIsEditingRundown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dragItem, setDragItem] = useState<number | null>(null);

  // Segment Edit State
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [segmentEditIndex, setSegmentEditIndex] = useState<number | null>(null);
  const [tempVisibleSegments, setTempVisibleSegments] = useState<number[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  
  // Running Text States
  const [runningText, setRunningText] = useState(localStorage.getItem('worship_rt_text') || '');
  const [rtPos, setRtPos] = useState(localStorage.getItem('worship_rt_pos') || 'bottom');
  const [rtSpeed, setRtSpeed] = useState(Number(localStorage.getItem('worship_rt_speed') || 15));
  const [isRtVisible, setIsRtVisible] = useState(false);
  
  // Add Item States
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'song'|'bible'>('song');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploadingSlides, setIsUploadingSlides] = useState(false);
  
  // Debounce ref to prevent spamming the API
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Ambil playlist dari server
  useEffect(() => {
    async function fetchPlaylist() {
      if (!playlistId) {
        setErrorMsg('ID Playlist tidak ditemukan di URL.');
        setIsLoading(false);
        return;
      }
      try {
        const res = await callApi('getPlaylistItems', { id: playlistId });
        if (res && res.success && res.data && res.data.items) {
          setPlaylistName(res.data.name);
          const processedItems = splitLongSegments(res.data.items);
          setPlaylist(processedItems);
        } else {
          setErrorMsg('Playlist kosong atau tidak ditemukan.');
        }
      } catch (err: any) {
        setErrorMsg('Gagal memuat playlist: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlaylist();
  }, [playlistId]);

  // Fungsi untuk push state ke GAS
  const pushStateToLive = async (itemIdx: number, segIdx: number, dispMode: string) => {
    if (playlist.length === 0) return;

    setIsSyncing(true);
    setErrorMsg('');
    const stateObj = {
      playlistId: playlistId,
      currentItemId: playlist[itemIdx].id,
      segmentIndex: segIdx,
      displayMode: dispMode,
      item: playlist[itemIdx] // we send this to local broadcast for fast local-sync
    };

    // 1. Broadcast secara lokal (seketika)
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
    channel.close();

    // 2. Kirim ke GAS (debounce sedikit untuk API rate limit)
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(async () => {
      try {
        await callApi('setLiveState', {}, { method: 'POST', payload: stateObj });
        setIsSyncing(false);
      } catch (err: any) {
        setIsSyncing(false);
        setErrorMsg('Gagal sync ke server: ' + err.message);
      }
    }, 200);
  };

  const removeRundownItem = (index: number) => {
    const newPlaylist = [...playlist];
    newPlaylist.splice(index, 1);
    setPlaylist(newPlaylist);
  };

  const removePlaylistItem = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRundownItem(index);
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = Number(e.dataTransfer.getData('text/plain'));
    if (fromIdx === toIdx || isNaN(fromIdx)) return;
    
    const newPlaylist = [...playlist];
    const item = newPlaylist.splice(fromIdx, 1)[0];
    newPlaylist.splice(toIdx, 0, item);
    
    if (activeItem === fromIdx) {
      setActiveItem(toIdx);
    } else if (activeItem > fromIdx && activeItem <= toIdx) {
      setActiveItem(activeItem - 1);
    } else if (activeItem < fromIdx && activeItem >= toIdx) {
      setActiveItem(activeItem + 1);
    }
    
    setPlaylist(newPlaylist);
    setDragItem(null);
  };

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isVideoUploading, setIsVideoUploading] = useState(false);

  const openVideoModal = (index: number | null = null) => {
    if (index !== null) setReplaceIndex(index);
    setVideoUrlInput('');
    setIsVideoModalOpen(true);
  };

  const handleVideoSubmit = () => {
    if (!videoUrlInput.trim()) return;
    const newItem = {
      id: 'video-' + Date.now(),
      type: 'video',
      title: 'Video / Multimedia',
      segments: [videoUrlInput.trim()],
    } as any;
    
    if (replaceIndex !== null) {
      const newPlaylist = [...playlist];
      newPlaylist[replaceIndex] = newItem;
      setPlaylist(newPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      setPlaylist([...playlist, newItem]);
      setActiveItem(playlist.length);
    }
    setIsVideoModalOpen(false);
    setIsAddItemModalOpen(false);
    saveRundown();
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 30 * 1024 * 1024) {
      alert("Ukuran video maksimal 30MB.");
      return;
    }
    
    setIsVideoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        try {
          const res = await callApi('uploadVideo', {}, { 
            method: 'POST', 
            payload: { video: { name: file.name, mimeType: file.type, base64: base64Data } } 
          });
          if (res.success && res.data.url) {
            setVideoUrlInput(res.data.url);
          } else {
            alert('Gagal mengupload video');
          }
        } catch (err) {
          alert('Error saat upload video');
        } finally {
          setIsVideoUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsVideoUploading(false);
      alert("Gagal membaca file");
    }
  };

  const addQuickAnnouncement = () => {
    const newAnnouncement = {
      id: 'custom-' + Date.now(),
      type: 'announcement',
      title: 'Pengumuman / Teks Bebas',
      segments: [''],
    };
    
    if (replaceIndex !== null) {
      const newPlaylist = [...playlist];
      newPlaylist[replaceIndex] = newAnnouncement as any;
      setPlaylist(newPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      const newPlaylist = [...playlist, newAnnouncement as any];
      setPlaylist(newPlaylist);
      setActiveItem(newPlaylist.length - 1);
    }
    
    setActiveSegment(0);
    setIsEditingRundown(true);
  };

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
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, searchType);
  };

  const addToRundown = (item: any) => {
    const newItem = { ...item, localId: Math.random().toString(36).substr(2, 9) };
    if (replaceIndex !== null) {
      const newPlaylist = [...playlist];
      newPlaylist[replaceIndex] = newItem;
      setPlaylist(newPlaylist);
      setReplaceIndex(null);
    } else {
      const newPlaylist = [...playlist, newItem];
      setPlaylist(newPlaylist);
    }
    setIsAddItemModalOpen(false);
    setIsEditingRundown(true);
  };

  const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            resolve({ name: file.name, mimeType: file.type, base64: base64Data });
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
        };
        if (replaceIndex !== null) {
          const newPlaylist = [...playlist];
          newPlaylist[replaceIndex] = newItem as any;
          setPlaylist(newPlaylist);
          setReplaceIndex(null);
        } else {
          const newPlaylist = [...playlist, newItem as any];
          setPlaylist(newPlaylist);
        }
        setIsAddItemModalOpen(false);
        setIsEditingRundown(true);
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

  const saveRundown = async () => {
    setIsSaving(true);
    const payload = {
      id: playlistId,
      name: playlistName,
      items: playlist.map((item) => {
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
      if (!res.success) alert(res.error?.message || 'Gagal menyimpan rundown');
    } catch (err) {
      alert('Error saat menyimpan rundown');
    }
    setIsSaving(false);
    setIsEditingRundown(false);
  };

  const openSegmentModal = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSegmentEditIndex(idx);
    setTempVisibleSegments(playlist[idx].visibleSegments || [...Array(playlist[idx].segments.length).keys()]);
    setIsSegmentModalOpen(true);
  };

  const toggleSegment = (segIdx: number) => {
    setTempVisibleSegments(prev => 
      prev.includes(segIdx) ? prev.filter(i => i !== segIdx) : [...prev, segIdx].sort((a, b) => a - b)
    );
  };

  const saveSegmentSelection = () => {
    if (segmentEditIndex !== null) {
      const newP = [...playlist];
      newP[segmentEditIndex].visibleSegments = tempVisibleSegments;
      setPlaylist(newP);
    }
    setIsSegmentModalOpen(false);
    setSegmentEditIndex(null);
  };

  // Sync saat ada perubahan
  useEffect(() => {
    pushStateToLive(activeItem, activeSegment, mode);
  }, [activeItem, activeSegment, mode, playlist]);

  const wrapText = (colorTag: string) => {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return; 

    const newPlaylist = [...playlist];
    const currentText = newPlaylist[activeItem].segments[activeSegment] || '';
    
    const before = currentText.substring(0, start);
    const selected = currentText.substring(start, end);
    const after = currentText.substring(end);
    
    newPlaylist[activeItem].segments[activeSegment] = `${before}[${colorTag}]${selected}[/${colorTag}]${after}`;
    setPlaylist(newPlaylist);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + selected.length + (colorTag.length * 2) + 5);
    }, 10);
  };

  const openDisplay = () => {
    window.open('#/display', '_blank', 'width=1280,height=720');
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        try {
          localStorage.setItem('custom_bg', dataUrl);
          // Broadcast custom background
          const channel = new BroadcastChannel('worship_live_sync');
          channel.postMessage({ type: 'BG_UPDATE', bg: dataUrl });
          channel.close();
          setIsBgModalOpen(false); // Close modal on success
        } catch (err) {
          console.error(err);
          alert('Gagal mengganti background. Kemungkinan ukuran gambar terlalu besar (Maksimal ~3MB). Silakan gunakan gambar dengan resolusi lebih kecil.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file logo terlalu besar. Maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        localStorage.setItem('worship_logo_b64', base64);
        
        // Broadcast logo update
        const channel = new BroadcastChannel('worship_live_sync');
        channel.postMessage({ type: 'LOGO_UPDATE', payload: base64, position: logoPos });
        channel.close();
        
        setIsLogoModalOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePositionChange = (pos: string) => {
    setLogoPos(pos);
    localStorage.setItem('worship_logo_position', pos);
    
    // Broadcast position update for existing logo
    const existingLogo = localStorage.getItem('worship_logo_b64');
    if (existingLogo) {
      const channel = new BroadcastChannel('worship_live_sync');
      channel.postMessage({ type: 'LOGO_UPDATE', payload: existingLogo, position: pos });
      channel.close();
    }
  };

  const broadcastRunningText = (visible: boolean) => {
    localStorage.setItem('worship_rt_text', runningText);
    localStorage.setItem('worship_rt_pos', rtPos);
    localStorage.setItem('worship_rt_speed', String(rtSpeed));
    setIsRtVisible(visible);

    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({
      type: 'RUNNING_TEXT_UPDATE',
      payload: { text: runningText, position: rtPos, speed: rtSpeed, isVisible: visible }
    });
    channel.close();
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    const item = playlist[activeItem];
    if (activeSegment < item.segments.length - 1) {
      setActiveSegment(s => s + 1);
    } else if (activeItem < playlist.length - 1) {
      setActiveItem(i => i + 1);
      setActiveSegment(0);
    }
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    if (activeSegment > 0) {
      setActiveSegment(s => s - 1);
    } else if (activeItem > 0) {
      setActiveItem(i => i - 1);
      setActiveSegment(playlist[activeItem - 1].segments.length - 1);
    }
  };

  // Keyboard / Presentation Pointer support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

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
        case 'b':
        case 'B':
        case '.':
          e.preventDefault();
          setMode(m => m === 'blank' ? 'content' : 'blank');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playlist, activeItem, activeSegment]);

  // Auto-scroll rundown ke item yang aktif
  useEffect(() => {
    const el = document.getElementById(`rundown-item-${activeItem}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeItem]);

  if (isLoading) {
    return <div className="h-screen flex justify-center items-center"><Loader2 className="animate-spin text-indigo-900" size={48} /></div>;
  }

  if (playlist.length === 0 && !isLoading) {
    return <div className="h-screen flex justify-center items-center text-red-500 font-bold">{errorMsg || 'Playlist kosong.'}</div>;
  }

  return (
    <div className="h-screen flex flex-col p-4 md:p-6 gap-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-white/20 pointer-events-none -z-10 backdrop-blur-[2px]"></div>
      
      <header className="glass-panel p-5 flex flex-col md:flex-row justify-between items-center shrink-0 gap-4 shadow-lg border-white/50">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900 flex items-center gap-2 font-medium">
            <ArrowLeft size={18}/> Dashboard
          </button>
          <h1 className="text-2xl font-heading font-extrabold text-indigo-900 tracking-tight drop-shadow-sm">Control Panel</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-center md:justify-end">
          {errorMsg && <div className="text-red-700 bg-red-100/90 px-3 py-1 rounded-lg text-sm border border-red-300 font-medium">{errorMsg}</div>}
          <SyncButton isParentSyncing={isSyncing} />
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl border border-red-400 shadow-lg shadow-red-500/30">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div> LIVE
          </div>
          <button 
            onClick={() => setIsRunningTextModalOpen(true)} 
            className={`glass-button flex items-center gap-2 transition-all ${isRtVisible ? 'bg-red-500 text-white hover:bg-red-600 border-red-500 shadow-red-500/30 shadow-md' : 'text-indigo-900'}`}
          >
            <Type size={18}/> Running Text
          </button>
          <button onClick={() => setIsLogoModalOpen(true)} className="glass-button text-indigo-900 flex items-center gap-2">
            <CheckCircle size={18}/> Ganti Logo
          </button>
          <button onClick={() => setIsBgModalOpen(true)} className="glass-button text-indigo-900 flex items-center gap-2">
            <ImageIcon size={18}/> Ganti BG
          </button>
          <button onClick={openDisplay} className="glass-button bg-indigo-600/10 text-indigo-900 flex items-center gap-2 border-indigo-400/30 font-bold hover:bg-indigo-600/20">
            <Monitor size={18}/> Buka Display
          </button>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <aside className="w-full h-1/3 lg:h-auto lg:w-[28%] glass-panel p-5 flex flex-col overflow-hidden shadow-lg border-white/50">
          <div className="flex justify-between items-center mb-5 shrink-0">
            <h2 className="font-heading font-bold text-indigo-950 uppercase tracking-wide">Rundown</h2>
            <button 
              onClick={() => {
                if (isEditingRundown) {
                  saveRundown();
                } else {
                  setIsEditingRundown(true);
                }
              }}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all shadow-sm font-semibold ${
                isEditingRundown 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30 hover:shadow-md' 
                  : 'glass-button text-indigo-900 hover:bg-white/70'
              }`}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : (isEditingRundown ? <Save size={16} /> : <Edit size={16} />)}
              {isEditingRundown ? 'Simpan' : 'Edit Rundown'}
            </button>
          </div>
          
          <div className="space-y-3 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent flex-1">
            {playlist.map((item, idx) => (
              <div 
                id={`rundown-item-${idx}`}
                key={item.id || idx} 
                className={`flex gap-2 transition-all duration-300 ${dragItem === idx ? 'opacity-40 scale-95' : 'hover:-translate-y-0.5'}`}
                draggable={isEditingRundown}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', idx.toString());
                  setDragItem(idx);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => setDragItem(null)}
              >
                <div 
                  onClick={() => { 
                    setActiveItem(idx); 
                    setActiveSegment(0); 
                  }}
                  className={`flex-1 text-left p-4 rounded-xl border backdrop-blur-sm transition-all ${isEditingRundown ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                    activeItem === idx
                      ? 'bg-white/80 border-indigo-400 shadow-md transform scale-[1.02]' 
                      : 'bg-white/30 border-white/40 hover:bg-white/50 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between w-full items-center">
                    <div className={`font-semibold text-lg select-none ${activeItem === idx ? 'text-indigo-900' : 'text-slate-800'}`}>
                      {idx + 1}. {item.title}
                    </div>
                    {isEditingRundown && (
                      <div className="flex gap-2">
                        {(item.type === 'song' || item.type === 'bible') && (
                          <button 
                            onClick={(e) => openSegmentModal(idx, e)}
                            className="text-indigo-600 hover:text-indigo-800 bg-indigo-100 p-1.5 rounded-lg transition-colors"
                            title="Atur Slide / Bait"
                          >
                            <Settings size={14} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (replaceIndex === idx) setReplaceIndex(null); 
                            else { setReplaceIndex(idx); setIsAddItemModalOpen(true); } 
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${replaceIndex === idx ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:text-indigo-800 bg-indigo-100'}`}
                          title="Ganti Item"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button 
                          onClick={(e) => removePlaylistItem(idx, e)}
                          className="text-red-500 hover:text-red-700 bg-red-100 p-1.5 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-bold text-indigo-600/70 uppercase mt-1 select-none tracking-wider">{item.type}</div>
                </div>
              </div>
            ))}
          </div>
          
          {replaceIndex !== null && (
            <div className="mt-2 bg-indigo-100 text-indigo-900 text-xs p-2 rounded-lg border border-indigo-200 flex justify-between items-center shrink-0">
              <span>Ganti: <strong>{playlist[replaceIndex]?.title}</strong></span>
              <button onClick={() => setReplaceIndex(null)} className="text-red-500 hover:bg-red-500/10 p-1 rounded"><X size={12}/></button>
            </div>
          )}

          <div className="mt-3 flex gap-2 shrink-0">
            <button 
              onClick={() => setIsAddItemModalOpen(true)}
              className="flex-1 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Search size={14} /> Lagu / Ayat
            </button>
            <button 
              onClick={addQuickAnnouncement}
              className="flex-1 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Plus size={14} /> Pengumuman
            </button>
            <button 
              onClick={() => openVideoModal(replaceIndex)}
              className="flex-1 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Plus size={14} /> Video
            </button>
          </div>
        </aside>
        
        <section className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="glass-panel flex-1 p-8 flex flex-col items-center justify-center relative shadow-lg overflow-hidden border-white/50 bg-gradient-to-br from-white/40 to-white/10">
              <div className="text-center max-w-5xl w-full flex flex-col items-center">
                {(playlist[activeItem]?.type === 'announcement' && isEditingRundown) ? (
                  <input 
                    className="text-3xl font-heading font-bold text-indigo-950 mb-6 drop-shadow-sm bg-white border-2 border-indigo-300 rounded-full px-6 py-2 shadow-inner text-center w-full max-w-xl focus:outline-none focus:border-indigo-500"
                    value={playlist[activeItem]?.title || ''}
                    onChange={(e) => {
                      const newPlaylist = [...playlist];
                      newPlaylist[activeItem].title = e.target.value;
                      setPlaylist(newPlaylist);
                    }}
                    placeholder="Judul Pengumuman / Teks Bebas"
                  />
                ) : (
                  <h3 className="text-3xl font-heading font-bold text-indigo-950 mb-4 drop-shadow-sm bg-white/30 inline-block px-6 py-2 rounded-full border border-white/40">{playlist[activeItem]?.title}</h3>
                )}
                
                {playlist[activeItem]?.segments && playlist[activeItem].segments.length > 1 && (
                  <div className="flex justify-center flex-wrap gap-2 mb-6 z-20">
                    {playlist[activeItem].segments.map((_: any, idx: number) => (
                      <button 
                        key={idx}
                        onClick={() => { setActiveSegment(idx); setMode('content'); }}
                        className={`px-4 py-2 font-semibold text-sm md:text-base rounded-xl transition-all duration-200 border shadow-sm hover:-translate-y-0.5 ${
                          activeSegment === idx && mode === 'content' 
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/30' 
                            : 'bg-white/70 text-indigo-900 border-white/50 hover:bg-white/90'
                        }`}
                      >
                        {playlist[activeItem]?.segmentLabels ? playlist[activeItem].segmentLabels[idx] : `Slide ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="text-4xl md:text-5xl font-bold text-indigo-900 leading-tight whitespace-pre-wrap w-full p-8 min-h-[30vh] flex items-center justify-center relative z-10 transition-all duration-300 animate-fade-in" key={`${activeItem}-${activeSegment}-${mode}`}>
                  {mode === 'blank' ? <span className="text-indigo-900/20 italic">Layar Kosong (Blank)</span> : (
                    <>
                      {(playlist[activeItem]?.type === 'slideshow') ? (
                        <div className="flex flex-col items-center">
                          <ImageIcon size={64} className="text-indigo-900/20 mb-4" />
                          <span className="text-indigo-900/40 italic text-xl">Slideshow Ditampilkan</span>
                        </div>
                      ) : (
                        (isEditingRundown) ? (
                          <div className="w-full relative">
                            {/* Toolbar Warna */}
                            <div className={`absolute -top-12 left-0 right-0 flex justify-center gap-2 transition-all duration-200 z-30 ${
                              hasSelection ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-2'
                            }`}>
                              <button onClick={() => wrapText('merah')} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm shadow-md font-bold hover:bg-red-600 transition">Merah</button>
                              <button onClick={() => wrapText('kuning')} className="px-3 py-1 bg-yellow-400 text-slate-900 rounded-lg text-sm shadow-md font-bold hover:bg-yellow-500 transition">Kuning</button>
                              <button onClick={() => wrapText('hijau')} className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm shadow-md font-bold hover:bg-green-600 transition">Hijau</button>
                              <button onClick={() => wrapText('biru')} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm shadow-md font-bold hover:bg-blue-600 transition">Biru</button>
                            </div>
                            <textarea 
                              id="editor-textarea"
                              className="w-full h-[30vh] bg-white/80 backdrop-blur-md border-2 border-indigo-300 rounded-2xl p-8 text-3xl md:text-4xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 shadow-inner font-medium text-slate-800 transition-all"
                              value={playlist[activeItem]?.segments[activeSegment] || ''}
                              onChange={(e) => {
                                const newPlaylist = [...playlist];
                                newPlaylist[activeItem].segments[activeSegment] = e.target.value;
                                setPlaylist(newPlaylist);
                              }}
                              onSelect={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setHasSelection(target.selectionStart !== target.selectionEnd);
                              }}
                              onBlur={() => {
                                // Tunggu sebentar sebelum menyembunyikan agar tombol sempat diklik
                                setTimeout(() => setHasSelection(false), 150);
                              }}
                              placeholder="Ketik teks di sini (blok teks untuk mewarnai)..."
                            />
                          </div>
                        ) : playlist[activeItem]?.segments[activeSegment] ? (
                          playlist[activeItem].segments[activeSegment]
                        ) : (
                          <span className="text-indigo-900/30 italic">Lirik tidak tersedia</span>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
          </div>
          
          <div className="glass-panel p-5 shrink-0 flex flex-wrap justify-center items-center gap-4 md:gap-6 shadow-lg border-white/50">
             <button onClick={handlePrev} className="glass-button bg-white/60 text-indigo-950 flex items-center gap-3 px-8 py-4 text-lg hover:bg-white/80 shadow-md rounded-2xl"><ArrowLeft size={24}/> Mundur</button>
             <button onClick={handleNext} className="glass-button bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-transparent flex items-center gap-3 px-8 py-4 text-lg hover:shadow-lg hover:shadow-indigo-500/30 rounded-2xl">Lanjut <ArrowRight size={24}/></button>
             <div className="w-px h-12 bg-indigo-900/20 mx-2 hidden md:block"></div>
             <button 
                onClick={() => setMode(m => m === 'blank' ? 'content' : 'blank')} 
                className={`glass-button flex items-center gap-3 px-8 py-4 text-lg rounded-2xl transition-all shadow-md ${mode === 'blank' ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 shadow-slate-900/40' : 'bg-white/60 text-slate-800 hover:bg-white/80'}`}
             >
               <Square size={20} className={mode === 'blank' ? "fill-white" : ""}/> Blank
             </button>
          </div>
        </section>
      </main>
      {/* MODAL TAMBAH ITEM (LAGU/AYAT/SLIDE) */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-lg w-full border border-white/40 max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Plus size={20} /> Tambah Item ke Rundown
            </h2>
            
            <div className="flex gap-2 mb-4">
              <button onClick={() => setSearchType('song')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-semibold ${searchType === 'song' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-900 border border-indigo-200'}`}><Music size={14}/> Lagu</button>
              <button onClick={() => setSearchType('bible')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-semibold ${searchType === 'bible' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-900 border border-indigo-200'}`}><BookOpen size={14}/> Ayat</button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari ${searchType === 'song' ? 'Lagu' : 'Ayat'}...`} 
                className="glass-input flex-1 !bg-white"
                autoFocus
              />
              <button type="submit" disabled={isSearching} className="glass-button bg-indigo-500/20 text-indigo-900 border-indigo-500/30 px-4">
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16}/>}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-[200px] border border-indigo-100 rounded-xl p-2 bg-slate-50/50">
              {searchResults.map((res) => (
                <div key={res.id} className="p-3 bg-white border border-indigo-100 rounded-xl hover:bg-indigo-50 transition cursor-pointer flex justify-between items-center" onClick={() => addToRundown(res)}>
                  <div>
                    <div className="font-semibold text-indigo-900 text-sm">{res.title}</div>
                    <div className="text-xs text-indigo-800/60 line-clamp-1">{res.segments[0]}</div>
                  </div>
                  <div className="text-lg font-bold text-indigo-900/30"><Plus size={18}/></div>
                </div>
              ))}
              {searchResults.length === 0 && !isSearching && searchQuery !== '' && (
                <div className="text-center text-sm text-indigo-900/60 p-4">Tidak ada hasil ditemukan.</div>
              )}
              {searchResults.length === 0 && !isSearching && searchQuery === '' && (
                <div className="text-center text-sm text-indigo-900/40 p-4 mt-8">Ketik kata kunci untuk mencari.</div>
              )}
            </div>

            <div className="flex justify-between items-center mt-2 border-t pt-4 border-indigo-100">
              <div className="relative">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  id="cp-slideshow-upload"
                  className="hidden"
                  onChange={handleSlideUpload}
                />
                <label 
                  htmlFor="cp-slideshow-upload"
                  className={`glass-button text-xs py-2 px-3 cursor-pointer flex items-center gap-2 ${isUploadingSlides ? 'bg-indigo-200 text-indigo-500' : 'bg-indigo-500/20 text-indigo-900'}`}
                >
                  {isUploadingSlides ? <Loader2 size={14} className="animate-spin" /> : <><ImageIcon size={14}/> Upload Slide/PPT</>}
                </label>
              </div>
              <button onClick={() => setIsAddItemModalOpen(false)} className="px-5 py-2 rounded-lg font-bold text-indigo-900 bg-black/5 hover:bg-black/10 transition text-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl max-w-xl w-full border border-white/50 relative">
            <button onClick={() => setIsVideoModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-all">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-indigo-900 mb-4">Tambahkan Video</h2>
            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Paste Link (YouTube / MP4 / Google Drive)</label>
                <input 
                  className="glass-input w-full font-semibold text-sm" 
                  value={videoUrlInput} 
                  onChange={e => setVideoUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ATAU</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Upload File Video (Maks 30MB)</label>
                <input 
                  type="file" 
                  accept="video/*" 
                  id="cp-video-file-upload"
                  className="hidden"
                  onChange={handleVideoUpload}
                />
                <label 
                  htmlFor="cp-video-file-upload"
                  className={`glass-button text-sm py-2 cursor-pointer flex justify-center items-center gap-2 w-full ${isVideoUploading ? 'bg-indigo-200 text-indigo-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {isVideoUploading ? <Loader2 size={16} className="animate-spin" /> : 'Pilih File Video'}
                </label>
              </div>
            </div>
            
            <button onClick={handleVideoSubmit} disabled={isVideoUploading || !videoUrlInput.trim()} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all mt-4">
              Tambahkan Video
            </button>
          </div>
        </div>
      )}
      {/* MODAL GANTI BACKGROUND */}
      {isBgModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/40">
            <h2 className="text-2xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <ImageIcon size={24} /> Ganti Latar Belakang
            </h2>
            <p className="text-indigo-900/70 mb-6">Pilih gambar dari komputer Anda untuk dijadikan latar belakang di layar Display. (Maksimal ~3MB)</p>
            
            <div className="flex flex-col gap-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/40 rounded-xl p-8 cursor-pointer hover:bg-indigo-50/50 transition">
                <ImageIcon size={48} className="text-indigo-300 mb-2" />
                <span className="font-semibold text-indigo-900">Pilih Gambar...</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleBackgroundUpload} 
                  className="hidden" 
                />
              </label>
              
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsBgModalOpen(false)} className="px-6 py-2 rounded-lg font-bold text-indigo-900 bg-black/5 hover:bg-black/10 transition">
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGO MODAL */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-white/40">
            <h2 className="text-xl font-bold text-indigo-900 mb-2">Logo & Watermark</h2>
            <p className="text-sm text-indigo-800/70 mb-6">Pilih gambar logo dan tentukan posisinya di layar penonton.</p>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-indigo-900 mb-2">Posisi Logo</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'top-left', label: 'Kiri Atas' },
                  { id: 'top-right', label: 'Kanan Atas' },
                  { id: 'bottom-left', label: 'Kiri Bawah' },
                  { id: 'bottom-right', label: 'Kanan Bawah' }
                ].map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => handlePositionChange(pos.id)}
                    className={`p-2 rounded-lg text-sm font-semibold border-2 transition ${
                      logoPos === pos.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-indigo-100 bg-white text-indigo-400 hover:border-indigo-300'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <input 
              type="file" 
              accept="image/*" 
              ref={logoInputRef}
              onChange={handleLogoUpload}
              className="hidden" 
            />
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => logoInputRef.current?.click()}
                className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 flex justify-center items-center gap-2 transition"
              >
                <Upload size={18} /> Ganti File Logo
              </button>
              
              <button 
                onClick={() => setIsLogoModalOpen(false)}
                className="w-full py-3 rounded-xl font-bold text-indigo-900 bg-black/5 hover:bg-black/10 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RUNNING TEXT MODAL */}
      {isRunningTextModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/40">
            <h2 className="text-xl font-bold text-indigo-900 mb-2">Running Text (Teks Berjalan)</h2>
            <p className="text-sm text-indigo-800/70 mb-6">Tampilkan pengumuman berjalan di layar.</p>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-indigo-900 mb-2">Daftar Pengumuman</label>
                <div className="max-h-48 overflow-y-auto pr-2 flex flex-col gap-2">
                  {runningText.split('\n').map((txt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="text"
                        value={txt}
                        onChange={(e) => {
                          const arr = runningText.split('\n');
                          arr[idx] = e.target.value;
                          setRunningText(arr.join('\n'));
                        }}
                        className="flex-1 bg-white border border-indigo-200 rounded-lg p-2 text-sm text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={`Pengumuman ${idx + 1}...`}
                      />
                      <button 
                        onClick={() => {
                          const arr = runningText.split('\n');
                          arr.splice(idx, 1);
                          setRunningText(arr.length ? arr.join('\n') : '');
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Hapus baris ini"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setRunningText(runningText ? runningText + '\n' : '\n')}
                  className="mt-3 w-full py-2 border border-indigo-200 border-dashed rounded-lg text-indigo-600 hover:bg-indigo-50 font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Tambah Pengumuman
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-indigo-900 mb-2">Posisi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRtPos('top')}
                    className={`p-2 rounded-lg text-sm font-semibold border-2 transition ${rtPos === 'top' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-indigo-100 bg-white text-indigo-400 hover:border-indigo-300'}`}
                  >
                    Atas
                  </button>
                  <button
                    onClick={() => setRtPos('bottom')}
                    className={`p-2 rounded-lg text-sm font-semibold border-2 transition ${rtPos === 'bottom' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-indigo-100 bg-white text-indigo-400 hover:border-indigo-300'}`}
                  >
                    Bawah
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-indigo-900 mb-2">
                  Kecepatan (Durasi: {rtSpeed} detik)
                </label>
                <input 
                  type="range" 
                  min="5" 
                  max="40" 
                  value={rtSpeed}
                  onChange={(e) => setRtSpeed(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-indigo-400 mt-1">
                  <span>Sangat Cepat</span>
                  <span>Normal</span>
                  <span>Sangat Lambat</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => broadcastRunningText(false)}
                  className="py-3 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                  disabled={!isRtVisible}
                >
                  Sembunyikan
                </button>
                <button 
                  onClick={() => broadcastRunningText(true)}
                  className="py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 transition"
                >
                  Tampilkan
                </button>
              </div>
              <button 
                onClick={() => setIsRunningTextModalOpen(false)}
                className="w-full py-3 rounded-xl font-bold text-indigo-900 bg-black/5 hover:bg-black/10 transition mt-2"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT SELECTION MODAL */}
      {isSegmentModalOpen && segmentEditIndex !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-white/40 flex flex-col max-h-[85vh]">
            <h2 className="text-2xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <CheckSquare size={24} /> Pilih Bait / Ayat
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 border border-indigo-100 rounded-xl p-3 bg-slate-50/50">
              {(playlist[segmentEditIndex].originalSegments || playlist[segmentEditIndex].segments).map((seg: string, i: number) => {
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
