import { useState, useEffect, useRef } from 'react';
import { Monitor, Square, Tv, ArrowRight, ArrowLeft, Loader2, Image as ImageIcon, Upload, CheckCircle, Type, Plus, Trash2, Edit, Save } from 'lucide-react';
import { callApi } from '../api';
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
  const [errorMsg, setErrorMsg] = useState('');
  const [logoPos, setLogoPos] = useState(localStorage.getItem('worship_logo_position') || 'bottom-right');
  
  // Edit Rundown States
  const [isEditingRundown, setIsEditingRundown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dragItem, setDragItem] = useState<number | null>(null);
  
  // Running Text States
  const [runningText, setRunningText] = useState(localStorage.getItem('worship_rt_text') || '');
  const [rtPos, setRtPos] = useState(localStorage.getItem('worship_rt_pos') || 'bottom');
  const [rtSpeed, setRtSpeed] = useState(Number(localStorage.getItem('worship_rt_speed') || 15));
  const [isRtVisible, setIsRtVisible] = useState(false);
  
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

  const saveRundown = async () => {
    setIsSaving(true);
    const payload = {
      id: playlistId,
      name: playlistName,
      items: playlist.map((item) => {
        let customText = '';
        if (item.type === 'announcement') customText = item.segments[0];
        if (item.type === 'slideshow') customText = JSON.stringify(item.segments);
        return {
          type: item.type,
          refId: (item.type === 'announcement' || item.type === 'slideshow') ? null : item.id,
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

  // Sync saat ada perubahan
  useEffect(() => {
    pushStateToLive(activeItem, activeSegment, mode);
  }, [activeItem, activeSegment, mode, playlist]);

  const openDisplay = () => {
    window.open('/display', '_blank', 'width=1280,height=720');
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

  if (isLoading) {
    return <div className="h-screen flex justify-center items-center"><Loader2 className="animate-spin text-indigo-900" size={48} /></div>;
  }

  if (playlist.length === 0 && !isLoading) {
    return <div className="h-screen flex justify-center items-center text-red-500 font-bold">{errorMsg || 'Playlist kosong.'}</div>;
  }

  return (
    <div className="h-screen flex flex-col p-4 gap-4 overflow-hidden">
      <header className="glass-panel p-4 flex flex-col md:flex-row justify-between items-center shrink-0 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900 flex items-center gap-2">
            <ArrowLeft size={16}/> Dashboard
          </button>
          <h1 className="text-xl font-bold text-indigo-900">Control Panel</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-center md:justify-end">
          {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
          <div className="text-sm text-indigo-900/60">
            {isSyncing ? 'Syncing...' : 'Synced ✅'}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-700 font-bold rounded-lg border border-red-500/30">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> LIVE
          </div>
          <button 
            onClick={() => setIsRunningTextModalOpen(true)} 
            className={`glass-button flex items-center gap-2 ${isRtVisible ? 'bg-red-500 text-white hover:bg-red-600 border-red-600' : 'text-indigo-900'}`}
          >
            <Type size={16}/> Running Text
          </button>
          <button onClick={() => setIsLogoModalOpen(true)} className="glass-button text-indigo-900 flex items-center gap-2">
            <CheckCircle size={16}/> Ganti Logo
          </button>
          <button onClick={() => setIsBgModalOpen(true)} className="glass-button text-indigo-900 flex items-center gap-2">
            <ImageIcon size={16}/> Ganti BG
          </button>
          <button onClick={openDisplay} className="glass-button text-indigo-900 flex items-center gap-2">
            <Monitor size={16}/> Buka Display
          </button>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        <aside className="w-full h-1/3 md:h-auto md:w-1/4 glass-panel p-4 flex flex-col overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-indigo-900 uppercase text-sm">Rundown</h2>
            <button 
              onClick={() => {
                if (isEditingRundown) {
                  saveRundown();
                } else {
                  setIsEditingRundown(true);
                }
              }}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${
                isEditingRundown 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                  : 'glass-button text-indigo-900'
              }`}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : (isEditingRundown ? <Save size={14} /> : <Edit size={14} />)}
              {isEditingRundown ? 'Simpan' : 'Edit'}
            </button>
          </div>
          
          <div className="space-y-2">
            {playlist.map((item, idx) => (
              <div 
                key={item.id || idx} 
                className={`flex gap-2 transition ${dragItem === idx ? 'opacity-50' : ''}`}
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
                    if (!isEditingRundown) {
                      setActiveItem(idx); 
                      setActiveSegment(0); 
                    }
                  }}
                  className={`flex-1 text-left p-3 rounded-lg border transition ${isEditingRundown ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                    activeItem === idx && !isEditingRundown
                      ? 'bg-white/60 border-indigo-500/50 shadow-sm' 
                      : 'bg-white/20 border-white/20 hover:bg-white/40'
                  }`}
                >
                  <div className="font-medium text-indigo-900 select-none">{idx + 1}. {item.title}</div>
                  <div className="text-xs text-indigo-800/60 uppercase mt-1 select-none">{item.type}</div>
                </div>
                {isEditingRundown && (
                  <div className="flex flex-col gap-1 w-10 shrink-0">
                    <button 
                      onClick={() => removeRundownItem(idx)}
                      className="flex-1 flex justify-center items-center bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
        
        <section className="flex-1 flex flex-col gap-4">
          <div className="glass-panel flex-1 p-6 flex flex-col items-center justify-center relative">
              <div className="text-center max-w-4xl">
                <h3 className="text-2xl font-bold text-indigo-900 mb-2">{playlist[activeItem]?.title}</h3>
                <div className="text-3xl font-semibold text-indigo-800 leading-relaxed whitespace-pre-wrap w-full">
                  {mode === 'blank' ? '' : (
                    playlist[activeItem]?.type === 'slideshow' 
                      ? <img src={playlist[activeItem]?.segments[activeSegment].replace('export=view', 'export=download')} alt="Slide Preview" className="max-h-[50vh] object-contain mx-auto rounded-xl shadow-lg border border-indigo-200" />
                      : (
                        (playlist[activeItem]?.type === 'announcement' && isEditingRundown) ? (
                          <textarea 
                            className="w-full h-[40vh] bg-white border-2 border-indigo-200 rounded-xl p-6 text-3xl focus:outline-none focus:border-indigo-500 shadow-inner"
                            value={playlist[activeItem]?.segments[0] || ''}
                            onChange={(e) => {
                              const newPlaylist = [...playlist];
                              newPlaylist[activeItem].segments[0] = e.target.value;
                              setPlaylist(newPlaylist);
                            }}
                            placeholder="Ketik pengumuman di sini..."
                          />
                        ) : playlist[activeItem]?.segments[activeSegment]
                      )
                  )}
                </div>
              </div>
             
             <div className="absolute bottom-6 left-0 right-0 flex justify-center flex-wrap gap-2 px-6">
                {playlist[activeItem]?.segments.map((_: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => { setActiveSegment(idx); setMode('content'); }}
                    className={`px-3 py-1 text-sm rounded-md transition ${
                      activeSegment === idx && mode === 'content' ? 'bg-indigo-600 text-white' : 'glass-button text-indigo-900'
                    }`}
                  >
                    {playlist[activeItem]?.segmentLabels ? playlist[activeItem].segmentLabels[idx] : idx + 1}
                  </button>
                ))}
             </div>
          </div>
          
          <div className="glass-panel p-4 shrink-0 flex justify-center gap-4">
             <button onClick={handlePrev} className="glass-button text-indigo-900 flex items-center gap-2 px-6"><ArrowLeft size={16}/> Prev</button>
             <button onClick={handleNext} className="glass-button bg-indigo-500/20 text-indigo-900 flex items-center gap-2 px-6">Next <ArrowRight size={16}/></button>
             <div className="w-px h-8 bg-indigo-900/20 mx-4 self-center"></div>
             <button 
                onClick={() => setMode(m => m === 'blank' ? 'content' : 'blank')} 
                className={`glass-button flex items-center gap-2 px-6 ${mode === 'blank' ? 'bg-indigo-900 text-white' : 'text-indigo-900'}`}
             >
               <Square size={16}/> Blank
             </button>
             <button className="glass-button text-indigo-900 flex items-center gap-2"><Tv size={16}/> Logo</button>
          </div>
        </section>
      </main>

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
    </div>
  );
}
