import { useState, useEffect, useRef } from 'react';
import { Monitor, Square, ArrowRight, ArrowLeft, Loader2, Image as ImageIcon, CheckCircle, Type, Plus, Trash2, Edit, Save, Search, Music, BookOpen, Settings, CheckSquare, X, RefreshCw, Clock } from 'lucide-react';
import { callApi } from '../api';
import { SyncButton } from '../components/SyncButton';
import { BackgroundPickerModal } from '../components/BackgroundPickerModal';
import { saveLocalVideo } from '../utils/imageStorage';
import { FooterClock } from '../components/FooterClock';
import { initDefaultDatabases, searchLocalSongs, searchLocalBible, syncCustomSongs, getDatabaseList, DatabaseVersion, getAllLocalSongTitles } from '../utils/dbStorage';

const processText = (raw: string) => {
  if (!raw) return '';
  let t = raw.replace(/\n/g, '<br/>');
  t = t.replace(/\[merah\](.*?)\[\/merah\]/gi, '<span class="text-red-500 font-bold">$1</span>');
  t = t.replace(/\[kuning\](.*?)\[\/kuning\]/gi, '<span class="text-yellow-400 font-bold">$1</span>');
  t = t.replace(/\[hijau\](.*?)\[\/hijau\]/gi, '<span class="text-green-400 font-bold">$1</span>');
  t = t.replace(/\[biru\](.*?)\[\/biru\]/gi, '<span class="text-blue-400 font-bold">$1</span>');
  t = t.replace(/\[ungu\](.*?)\[\/ungu\]/gi, '<span class="text-purple-400 font-bold">$1</span>');
  t = t.replace(/\[oranye\](.*?)\[\/oranye\]/gi, '<span class="text-orange-400 font-bold">$1</span>');
  return t;
};

const bibleBooks = [
  "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan", "Yosua", "Hakim-Hakim", "Rut", 
  "1 Samuel", "2 Samuel", "1 Raja-Raja", "2 Raja-Raja", "1 Tawarikh", "2 Tawarikh", "Ezra", "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal", "Pengkhotbah", "Kidung Agung", "Yesaya", "Yeremia", "Ratapan", "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja", "Yunus", "Mikha", "Nahum", "Habakuk", "Zefanya", "Hagai", "Zakharia", "Maleakhi",
  "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "2 Korintus", "Galatia", "Efesus", "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius", "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus", "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes", "3 Yohanes", "Yudas", "Wahyu"
];
import { splitLongSegments } from '../utils/textSplitter';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ControlPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const urlId = searchParams.get('id');
  
  const [playlistId] = useState<string | null>(urlId === 'new' ? 'pl_' + Date.now() : urlId);
  const [playlistDate, setPlaylistDate] = useState(new Date().toISOString().split('T')[0]);

  const [playlist, setPlaylist] = useState<any[]>([]);
  const [playlistName, setPlaylistName] = useState('Memuat...');
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeItem, setActiveItem] = useState(0);
  const [activeSegment, setActiveSegment] = useState(0);
  const [mode, setMode] = useState<'content' | 'blank' | 'logo'>('content');
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isBgPickerOpen, setIsBgPickerOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isRunningTextModalOpen, setIsRunningTextModalOpen] = useState(false);
  const [isCountdownModalOpen, setIsCountdownModalOpen] = useState(false);
  const [countdownInputValue, setCountdownInputValue] = useState('5');
  const [isSyncing, setIsSyncing] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [logos, setLogos] = useState<any[]>(() => {
    const saved = localStorage.getItem('worship_logos_array');
    if (saved) return JSON.parse(saved);
    const oldUrl = localStorage.getItem('worship_logo_b64');
    if (oldUrl) {
      const oldPos = localStorage.getItem('worship_logo_position') || 'bottom-right';
      let x = 90, y = 90;
      if (oldPos === 'top-left') { x = 10; y = 10; }
      else if (oldPos === 'top-right') { x = 90; y = 10; }
      else if (oldPos === 'bottom-left') { x = 10; y = 90; }
      const scale = parseFloat(localStorage.getItem('worship_logo_scale') || '1');
      return [{ id: 'logo-' + Date.now(), url: oldUrl, x, y, scale }];
    }
    return [];
  });

  const [isEditingRundown, setIsEditingRundown] = useState(urlId === 'new');
  const [isSaving, setIsSaving] = useState(false);
  const [dragItem, setDragItem] = useState<number | null>(null);
  
  const [activeDragLogo, setActiveDragLogo] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [allSongTitles, setAllSongTitles] = useState<{id: string, title: string}[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [liveCountdown, setLiveCountdown] = useState<{id: string, start: number, duration: number} | null>(null);
  const [previewCountdown, setPreviewCountdown] = useState<number | null>(null);
  
  const [dbList, setDbList] = useState<DatabaseVersion[]>([]);
  const [selectedSongVersion, setSelectedSongVersion] = useState('song_LSEB');
  const [selectedBibleVersion, setSelectedBibleVersion] = useState('bible_TB');
  
  const [currentBg, setCurrentBg] = useState(localStorage.getItem('custom_bg') || '');

  // Initialize DBs on mount
  useEffect(() => {
    initDefaultDatabases().then(() => {
      getDatabaseList().then(setDbList);
      syncCustomSongs(); // Sync background
    });
  }, []);

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

  useEffect(() => {
    if (isAddItemModalOpen) {
      getAllLocalSongTitles(selectedSongVersion).then(res => {
        if (Array.isArray(res)) setAllSongTitles(res);
      }).catch(err => console.error("Gagal memuat judul lagu", err));
    }
  }, [isAddItemModalOpen, selectedSongVersion]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'song'|'bible'>('song');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploadingSlides, setIsUploadingSlides] = useState(false);
  
  const [isAutoSplitEnabled, setIsAutoSplitEnabled] = useState(
    localStorage.getItem('worship_auto_split') !== 'false'
  );
  const toggleAutoSplit = () => {
    const newVal = !isAutoSplitEnabled;
    setIsAutoSplitEnabled(newVal);
    localStorage.setItem('worship_auto_split', String(newVal));
  };

  // Debounce ref to prevent spamming the API
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Ambil playlist dari server
  useEffect(() => {
    async function fetchPlaylist() {
      if (!playlistId || urlId === 'new') {
        setPlaylistName('Ibadah Umum');
        setPlaylist([]);
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (liveCountdown && playlist[activeItem]?.id === liveCountdown.id && !isEditingRundown) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - liveCountdown.start) / 1000);
        const rem = Math.max(0, liveCountdown.duration - elapsed);
        setPreviewCountdown(rem);
        if (rem === 0) {
          if (activeItem < playlist.length - 1) {
            setActiveItem(activeItem + 1);
            setActiveSegment(0);
          }
        }
      };
      tick();
      interval = setInterval(tick, 1000);
    } else {
      setPreviewCountdown(null);
    }
    return () => clearInterval(interval);
  }, [liveCountdown, playlist, activeItem, isEditingRundown]);

  // Fungsi untuk push state ke GAS
  const pushStateToLive = async (itemIdx: number, segIdx: number, dispMode: string) => {
    // Jika mode blank/content, selalu broadcast meski playlist kosong
    if (playlist.length === 0) {
      // Hanya broadcast displayMode saja (tanpa item)
      const channel = new BroadcastChannel('worship_live_sync');
      channel.postMessage({ type: 'STATE_UPDATE', state: { displayMode: dispMode, updatedAt: Date.now() } });
      channel.close();
      return;
    }

    setIsSyncing(true);
    setErrorMsg('');
    const stateObj = {
      playlistId: playlistId,
      currentItemId: playlist[itemIdx].id,
      segmentIndex: segIdx,
      displayMode: dispMode,
      item: playlist[itemIdx], // we send this to local broadcast for fast local-sync
      updatedAt: Date.now()
    };

    if (playlist[itemIdx].type === 'countdown') {
      setLiveCountdown({
        id: playlist[itemIdx].id,
        start: stateObj.updatedAt,
        duration: parseInt(playlist[itemIdx].segments[segIdx] || '0')
      });
    } else {
      setLiveCountdown(null);
    }

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
    setIsEditingRundown(true);
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
    if (index !== null) {
      setReplaceIndex(index);
      if (playlist[index]?.type === 'video') {
        setVideoUrlInput(playlist[index].segments[0] || '');
      } else {
        setVideoUrlInput('');
      }
    } else {
      setVideoUrlInput('');
    }
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
    
    let finalPlaylist = [];
    if (replaceIndex !== null) {
      finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newItem;
      setPlaylist(finalPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      finalPlaylist = [...playlist, newItem];
      setPlaylist(finalPlaylist);
      setActiveItem(finalPlaylist.length);
    }
    setIsVideoModalOpen(false);
    setIsAddItemModalOpen(false);
    setIsEditingRundown(true);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsVideoUploading(true);
    try {
      const vidId = Date.now().toString();
      // Simpan file blob langsung ke IndexedDB
      await saveLocalVideo(vidId, file);
      
      // Set referensi ID ke input URL
      setVideoUrlInput(`local_vid_${vidId}`);
      // Opsional: ganti nama file jadi title agar rapi
      // Tapi karena komponen handleVideoSubmit menggunakan videoUrlInput sebagai segment, kita set ke local_vid_
    } catch (err: any) {
      alert('Error saat menyimpan video ke memori lokal: ' + (err.message || 'Unknown error'));
    } finally {
      setIsVideoUploading(false);
    }
  };

  const addQuickAnnouncement = () => {
    const newAnnouncement = {
      id: 'custom-' + Date.now(),
      type: 'announcement',
      title: 'Pengumuman / Teks Bebas',
      segments: [''],
    };
    
    let finalPlaylist = [];
    if (replaceIndex !== null) {
      finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newAnnouncement as any;
      setPlaylist(finalPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      finalPlaylist = [...playlist, newAnnouncement as any];
      setPlaylist(finalPlaylist);
      setActiveItem(finalPlaylist.length - 1);
    }
    
    setActiveSegment(0);
    setIsEditingRundown(true);
  };

  const addCountdown = () => {
    setCountdownInputValue('5');
    setIsCountdownModalOpen(true);
  };

  const handleCountdownSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const timeInput = countdownInputValue;
    
    let totalSeconds = 0;
    const cleanInput = timeInput.toLowerCase().trim();
    
    if (cleanInput.includes('m') || cleanInput.includes('s')) {
      const minMatch = cleanInput.match(/(\d+(?:\.\d+)?)\s*m/);
      const secMatch = cleanInput.match(/(\d+(?:\.\d+)?)\s*s/);
      if (minMatch) totalSeconds += parseFloat(minMatch[1]) * 60;
      if (secMatch) totalSeconds += parseFloat(secMatch[1]);
    } else {
      const val = parseFloat(cleanInput);
      if (!isNaN(val)) totalSeconds = val * 60;
    }

    if (totalSeconds <= 0 || isNaN(totalSeconds)) {
      alert("Durasi tidak valid!");
      return;
    }

    const newCountdown = {
      id: 'countdown-' + Date.now(),
      type: 'countdown',
      title: 'Ibadah Dimulai Dalam',
      segments: [String(Math.floor(totalSeconds))],
    };
    
    let finalPlaylist = [];
    if (replaceIndex !== null) {
      finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newCountdown as any;
      setPlaylist(finalPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      finalPlaylist = [...playlist, newCountdown as any];
      setPlaylist(finalPlaylist);
      setActiveItem(finalPlaylist.length - 1);
    }
    
    setActiveSegment(0);
    setIsVideoModalOpen(false);
    setIsAddItemModalOpen(false);
    setIsCountdownModalOpen(false);
    setIsEditingRundown(true);
  };

  const performSearch = async (query: string, type: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      if (type === 'song') {
        const results = await searchLocalSongs(query, selectedSongVersion);
        setSearchResults(results.slice(0, 50));
      } else {
        const results = await searchLocalBible(query, selectedBibleVersion);
        const formattedResults = results.map((item: any, idx: number) => ({
          id: item.isRange ? item.id : `b_${idx}`,
          type: 'bible',
          title: item.isRange ? item.title : `${item.book} ${item.chapter}:${item.verse}`,
          author: 'Alkitab',
          category: 'Alkitab',
          segments: item.isRange ? item.segments : [item.text],
          segmentOrder: item.isRange ? item.segments.map((_:any, i:number) => i) : [0]
        }));
        setSearchResults(formattedResults);
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
    // Add type if missing
    if (!item.type) {
      item.type = item.book ? 'bible' : 'song';
    }
    
    // Process segments for long texts
    const processedItem = isAutoSplitEnabled ? splitLongSegments([item])[0] : item;
    
    const newItem = { ...processedItem, localId: Math.random().toString(36).substr(2, 9) };
    let finalPlaylist = [];
    if (replaceIndex !== null) {
      finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newItem;
      setPlaylist(finalPlaylist);
      setReplaceIndex(null);
    } else {
      finalPlaylist = [...playlist, newItem];
      setPlaylist(finalPlaylist);
    }
    setIsAddItemModalOpen(false);
    setIsEditingRundown(true);
  };

  const handleQuickAddSong = async (id: string) => {
    try {
      setIsSearching(true);
      const res = await searchLocalSongs(id, selectedSongVersion);
      if (res && res.length > 0) {
        // Find exact match just in case
        const exact = res.find((s: any) => s.id == id) || res[0];
        exact.type = 'song'; // Ensure type is explicitly set
        const processed = isAutoSplitEnabled ? splitLongSegments([exact])[0] : exact;
        
        // Add to rundown
        let newIndex = playlist.length;
        setPlaylist(prev => {
          let newPlaylist = [...prev];
          if (replaceIndex !== null) {
            newPlaylist[replaceIndex] = processed;
            newIndex = replaceIndex;
          } else {
            newPlaylist.push(processed);
          }
          return newPlaylist;
        });
        
        setReplaceIndex(null);
        setIsAddItemModalOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        
        // Make it active immediately
        setActiveItem(newIndex);
        setActiveSegment(0);
        setIsEditingRundown(true);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengambil data lagu');
    } finally {
      setIsSearching(false);
    }
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
        let finalPlaylist = [];
        if (replaceIndex !== null) {
          finalPlaylist = [...playlist];
          finalPlaylist[replaceIndex] = newItem as any;
          setReplaceIndex(null);
        } else {
          finalPlaylist = [...playlist, newItem as any];
        }
        setPlaylist(finalPlaylist);
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

  const saveRundown = async (overridePlaylist?: any[]) => {
    setIsSaving(true);
    const targetPlaylist = overridePlaylist || playlist;
    const payload = {
      id: playlistId,
      name: playlistName,
      date: playlistDate,
      items: targetPlaylist.map((item) => {
        // Prepare local copy of the item so we don't lose titles/segments on save
        let localItem = { ...item };
        
        // Convert visible segments for backwards compatibility if needed, though we can just keep it directly on the object.
        let customText = '';
        if (item.type === 'announcement' || item.type === 'video') customText = item.segments[0];
        if (item.type === 'slideshow') customText = JSON.stringify(item.segments);
        if (item.type === 'song' || item.type === 'bible') customText = item.visibleSegments ? JSON.stringify(item.visibleSegments) : '';
        
        localItem.customText = customText;
        localItem.refId = (item.type === 'announcement' || item.type === 'video') ? item.title : (item.type === 'slideshow' ? null : (item.refId || item.id));
        
        return localItem;
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
    let finalPlaylist = [...playlist];
    if (segmentEditIndex !== null) {
      finalPlaylist[segmentEditIndex].visibleSegments = tempVisibleSegments;
      setPlaylist(finalPlaylist);
      setIsEditingRundown(true);
    }
    setIsSegmentModalOpen(false);
    setSegmentEditIndex(null);
  };

  // Sync saat ada perubahan
  useEffect(() => {
    if (!isEditingRundown) {
      pushStateToLive(activeItem, activeSegment, mode);
    }
  }, [activeItem, activeSegment, mode, playlist, isEditingRundown]);

  const wrapText = (colorTag: string) => {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return; 

    const currentText = playlist[activeItem]?.segments[activeSegment] || '';
    const before = currentText.substring(0, start);
    const selected = currentText.substring(start, end);
    const after = currentText.substring(end);

    setPlaylist(prev => {
      const newPlaylist = [...prev];
      newPlaylist[activeItem] = {
        ...newPlaylist[activeItem],
        segments: [...newPlaylist[activeItem].segments]
      };
      newPlaylist[activeItem].segments[activeSegment] = `${before}[${colorTag}]${selected}[/${colorTag}]${after}`;
      return newPlaylist;
    });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + selected.length + (colorTag.length * 2) + 5);
    }, 10);
  };

  const openDisplay = () => {
    window.open('#/display', '_blank', 'width=1280,height=720');
  };

  const handleGlobalBackgroundSelect = (bgUrl: string | null) => {
    try {
      if (bgUrl === null) {
        localStorage.removeItem('custom_bg');
        setCurrentBg('');
      } else {
        localStorage.setItem('custom_bg', bgUrl);
        setCurrentBg(bgUrl);
      }
      
      // Broadcast custom background
      const channel = new BroadcastChannel('worship_live_sync');
      channel.postMessage({ type: 'BG_UPDATE', bg: bgUrl || '' });
      channel.close();
      setIsBgModalOpen(false); // Close modal on success
    } catch (err) {
      console.error(err);
      alert('Gagal mengganti background.');
    }
  };

  const broadcastLogos = (newLogos: any[]) => {
    localStorage.setItem('worship_logos_array', JSON.stringify(newLogos));
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'LOGOS_UPDATE', payload: newLogos });
    channel.close();
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
        const newLogo = { id: 'logo-' + Date.now(), url: base64, x: 50, y: 50, scale: 1 };
        const newLogos = [...logos, newLogo];
        setLogos(newLogos);
        broadcastLogos(newLogos);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateLogo = (id: string, updates: any) => {
    const newLogos = logos.map(l => l.id === id ? { ...l, ...updates } : l);
    setLogos(newLogos);
    broadcastLogos(newLogos);
  };

  const removeLogo = (id: string) => {
    const newLogos = logos.filter(l => l.id !== id);
    setLogos(newLogos);
    broadcastLogos(newLogos);
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
    return <div className="h-full flex justify-center items-center"><Loader2 className="animate-spin text-indigo-900" size={48} /></div>;
  }


  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-white/20 pointer-events-none -z-10 backdrop-blur-[2px]"></div>
      
      <header className="glass-panel p-3 md:p-5 flex flex-col md:flex-row justify-between items-center shrink-0 gap-3 md:gap-4 shadow-lg border-white/50">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start shrink-0">
          <button onClick={() => navigate('/dashboard')} className="glass-button text-indigo-900 flex items-center gap-2 font-medium px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base">
            <ArrowLeft size={16}/> Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-heading font-extrabold text-indigo-900 tracking-tight drop-shadow-sm">Control Panel</h1>
          </div>
        </div>
        <div className="flex flex-nowrap overflow-x-auto w-full md:w-auto items-center gap-2 md:gap-4 justify-start md:justify-end pb-1 scrollbar-hide">
          {errorMsg && <div className="text-red-700 bg-red-100/90 px-3 py-1 rounded-lg text-xs md:text-sm border border-red-300 font-medium whitespace-nowrap">{errorMsg}</div>}
          <div className="shrink-0">
            <SyncButton isParentSyncing={isSyncing} />
          </div>
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl border border-red-400 shadow-lg shadow-red-500/30 text-sm md:text-base">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white animate-pulse"></div> LIVE
          </div>
          <button 
            onClick={() => setIsRunningTextModalOpen(true)} 
            className={`shrink-0 glass-button flex items-center gap-2 transition-all px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base ${isRtVisible ? 'bg-red-500 text-white hover:bg-red-600 border-red-500 shadow-red-500/30 shadow-md' : 'text-indigo-900'}`}
          >
            <Type size={16}/> Running Text
          </button>
          <button onClick={() => setIsLogoModalOpen(true)} className="shrink-0 glass-button text-indigo-900 flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base">
            <CheckCircle size={16}/> Logo
          </button>
          <button onClick={() => setIsBgModalOpen(true)} className="shrink-0 glass-button text-indigo-900 flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base">
            <ImageIcon size={16}/> BG
          </button>
          <button onClick={openDisplay} className="shrink-0 glass-button bg-indigo-600/10 text-indigo-900 flex items-center gap-2 border-indigo-400/30 font-bold hover:bg-indigo-600/20 px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base">
            <Monitor size={16}/> Display
          </button>
        </div>
      </header>
      
      <FooterClock />

      <main className="flex-1 flex flex-col lg:flex-row gap-3 md:gap-6 min-h-0">
        <aside className="w-full h-[35%] lg:h-auto lg:w-[28%] glass-panel p-3 md:p-5 flex flex-col overflow-hidden shadow-lg border-white/50">
          <div className="flex justify-between items-start mb-3 md:mb-5 shrink-0 gap-2">
            <div className="flex-1">
              {isEditingRundown ? (
                <div className="flex flex-col gap-1 w-full">
                  <input 
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="bg-white/50 text-indigo-950 font-bold px-2 py-1 rounded border border-indigo-200 focus:outline-none focus:border-indigo-500 w-full text-sm"
                    placeholder="Nama Playlist"
                  />
                  <input 
                    type="date"
                    value={playlistDate}
                    onChange={(e) => setPlaylistDate(e.target.value)}
                    className="bg-white/50 text-indigo-900 px-2 py-1 rounded border border-indigo-200 focus:outline-none focus:border-indigo-500 w-full text-xs"
                  />
                </div>
              ) : (
                <>
                  <h2 className="font-heading font-bold text-indigo-950 uppercase tracking-wide text-sm md:text-base leading-tight">{playlistName}</h2>
                  <div className="text-xs text-indigo-600/80 font-medium">{playlistDate}</div>
                </>
              )}
            </div>
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
          
          <div className="space-y-1 overflow-y-auto px-1.5 pt-1 pr-2 pb-4 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent flex-1">
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
                  className={`flex-1 text-left py-2 px-3 rounded-md border backdrop-blur-sm transition-all ${isEditingRundown ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                    activeItem === idx
                      ? 'bg-white/80 border-indigo-400 shadow-sm transform scale-[1.01]' 
                      : 'bg-white/30 border-white/40 hover:bg-white/50 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between w-full items-center">
                    <div className={`font-semibold text-sm select-none truncate ${activeItem === idx ? 'text-indigo-900' : 'text-slate-800 dark:text-slate-200'}`}>
                      {idx + 1}. {item.title || item.name || '(Tanpa Judul)'}
                    </div>
                    {isEditingRundown && (
                      <div className="flex gap-2">
                        {(item.type === 'song' || item.type === 'bible' || item.type === 'video') && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.type === 'video') openVideoModal(idx);
                              else openSegmentModal(idx, e);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 bg-indigo-100 p-1 rounded transition-colors"
                            title={item.type === 'video' ? "Edit Link Video" : "Atur Slide / Bait"}
                          >
                            <Settings size={12} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (replaceIndex === idx) setReplaceIndex(null); 
                            else { setReplaceIndex(idx); setIsAddItemModalOpen(true); } 
                          }}
                          className={`p-1 rounded transition-colors ${replaceIndex === idx ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:text-indigo-800 bg-indigo-100'}`}
                          title="Ganti Item"
                        >
                          <RefreshCw size={12} />
                        </button>
                        <button 
                          onClick={(e) => removePlaylistItem(idx, e)}
                          className="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded transition-colors"
                          title="Hapus"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600/70 uppercase mt-0.5 select-none tracking-wider">{item.type}</div>
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
          <div className="mt-3 grid grid-cols-2 gap-2 shrink-0">
            <button 
              onClick={() => setIsAddItemModalOpen(true)}
              className="glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Search size={14} /> Lagu / Ayat
            </button>
            <button 
              onClick={addQuickAnnouncement}
              className="glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Plus size={14} /> Pengumuman
            </button>
            <button 
              onClick={() => openVideoModal(replaceIndex)}
              className="glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Plus size={14} /> Video
            </button>
            <button 
              onClick={addCountdown}
              className="glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-2 text-indigo-900 py-2 text-xs font-semibold hover:bg-white/70 transition-all"
            >
              <Plus size={14} /> Countdown
            </button>
          </div>
        </aside>
        
        <section className="flex-1 flex flex-col gap-3 md:gap-6 min-w-0">
          <div className="glass-panel flex-1 p-4 md:p-6 flex flex-col items-center justify-center relative shadow-lg overflow-hidden border-white/50 bg-gradient-to-br from-white/40 to-white/10">
              <div className="text-center w-full flex flex-col items-center h-full max-h-full overflow-hidden">
                {((playlist[activeItem]?.type === 'announcement' || playlist[activeItem]?.type === 'countdown') && isEditingRundown) ? (
                  <input 
                    className="text-xl md:text-3xl font-heading font-bold text-indigo-950 mb-4 md:mb-6 drop-shadow-sm bg-white border-2 border-indigo-300 rounded-full px-4 py-1.5 md:px-6 md:py-2 shadow-inner text-center w-full max-w-xl focus:outline-none focus:border-indigo-500"
                    value={playlist[activeItem]?.title || ''}
                    onChange={(e) => {
                      setPlaylist(prev => {
                        const newPlaylist = [...prev];
                        newPlaylist[activeItem] = { ...newPlaylist[activeItem], title: e.target.value };
                        return newPlaylist;
                      });
                    }}
                    placeholder="Judul Pengumuman / Teks Bebas"
                  />
                ) : (
                  <h3 className="text-xl md:text-3xl font-heading font-bold text-indigo-950 mb-3 md:mb-4 drop-shadow-sm bg-white/30 inline-block px-4 py-1.5 md:px-6 md:py-2 rounded-full border border-white/40">{playlist[activeItem]?.title}</h3>
                )}
                
                {/* Segment buttons moved to bottom bar */}

                <div className="w-full flex-1 min-h-0 flex items-center justify-center relative z-10 transition-all duration-300 animate-fade-in" key={`${activeItem}-${activeSegment}-${mode}`}>
                  {mode === 'blank' ? <span className="text-indigo-900/20 dark:text-slate-200/20 text-2xl font-bold italic">Layar Kosong (Blank)</span> : (
                    <>
                      {(playlist[activeItem]?.type === 'video') ? (
                        <div className="flex flex-col items-center">
                          <Monitor size={48} className="text-indigo-900/40 mb-2 md:mb-4" />
                          <span className="text-indigo-900/60 italic text-sm md:text-xl">Memutar Video</span>
                        </div>
                      ) : (playlist[activeItem]?.type === 'countdown') ? (
                        <div className="flex flex-col items-center w-full">
                          {isEditingRundown ? (
                            <div className="flex gap-4 items-center justify-center">
                              <div className="flex flex-col items-center">
                                <input 
                                  type="number"
                                  className="w-full text-center bg-white/80 backdrop-blur-md border-2 border-indigo-300 rounded-2xl p-3 md:p-4 text-3xl md:text-4xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 shadow-inner font-medium text-slate-800 transition-all max-w-[120px]"
                                  value={Math.floor(parseInt(playlist[activeItem]?.segments[activeSegment] || '0') / 60)}
                                  onChange={(e) => {
                                    setPlaylist(prev => {
                                      const newPlaylist = [...prev];
                                      newPlaylist[activeItem] = {
                                        ...newPlaylist[activeItem],
                                        segments: [...newPlaylist[activeItem].segments]
                                      };
                                      const currentSec = parseInt(newPlaylist[activeItem].segments[activeSegment] || '0') % 60;
                                      newPlaylist[activeItem].segments[activeSegment] = String(Number(e.target.value) * 60 + currentSec);
                                      return newPlaylist;
                                    });
                                  }}
                                />
                                <span className="text-indigo-900/60 mt-2 text-xs md:text-sm font-bold uppercase tracking-wider">Menit</span>
                              </div>
                              <div className="text-4xl font-bold text-indigo-900/40 pb-6">:</div>
                              <div className="flex flex-col items-center">
                                <input 
                                  type="number"
                                  className="w-full text-center bg-white/80 backdrop-blur-md border-2 border-indigo-300 rounded-2xl p-3 md:p-4 text-3xl md:text-4xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 shadow-inner font-medium text-slate-800 transition-all max-w-[120px]"
                                  value={parseInt(playlist[activeItem]?.segments[activeSegment] || '0') % 60}
                                  onChange={(e) => {
                                    setPlaylist(prev => {
                                      const newPlaylist = [...prev];
                                      newPlaylist[activeItem] = {
                                        ...newPlaylist[activeItem],
                                        segments: [...newPlaylist[activeItem].segments]
                                      };
                                      const currentMin = Math.floor(parseInt(newPlaylist[activeItem].segments[activeSegment] || '0') / 60);
                                      newPlaylist[activeItem].segments[activeSegment] = String(currentMin * 60 + Number(e.target.value));
                                      return newPlaylist;
                                    });
                                  }}
                                />
                                <span className="text-indigo-900/60 mt-2 text-xs md:text-sm font-bold uppercase tracking-wider">Detik</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-6xl font-mono text-indigo-900 bg-white/50 px-10 py-6 rounded-3xl border border-indigo-200 shadow-inner">
                              {(() => {
                                const displaySecs = previewCountdown !== null ? previewCountdown : parseInt(playlist[activeItem]?.segments[0] || '0');
                                return `${Math.floor(displaySecs / 60).toString().padStart(2, '0')}:${(displaySecs % 60).toString().padStart(2, '0')}`;
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (playlist[activeItem]?.type === 'slideshow') ? (
                        <div className="flex flex-col items-center">
                          <ImageIcon size={48} className="text-indigo-900/40 mb-2 md:mb-4" />
                          <span className="text-indigo-900/60 italic text-sm md:text-xl">Slideshow Ditampilkan</span>
                        </div>
                      ) : (
                        <div className="w-full flex flex-col lg:flex-row gap-4 md:gap-6 relative text-left h-full flex-1 min-h-0">
                          <div className="w-full lg:w-1/2 relative flex flex-col justify-center h-full min-h-0">
                            {isEditingRundown ? (
                              <div className="w-full h-full flex flex-col relative min-h-0">
                                {/* Toolbar Warna dipindahkan ke bawah */}
                                <textarea 
                                  id="editor-textarea"
                                  className="w-full flex-1 bg-white/80 backdrop-blur-md border border-indigo-200 rounded-xl p-4 text-lg md:text-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 shadow-inner text-indigo-900 whitespace-pre-wrap leading-relaxed transition-all resize-none text-center"
                                  value={playlist[activeItem]?.segments[activeSegment] || ''}
                                  onChange={(e) => {
                                    setPlaylist(prev => {
                                      const newPlaylist = [...prev];
                                      newPlaylist[activeItem] = {
                                        ...newPlaylist[activeItem],
                                        segments: [...newPlaylist[activeItem].segments]
                                      };
                                      newPlaylist[activeItem].segments[activeSegment] = e.target.value;
                                      return newPlaylist;
                                    });
                                  }}
                                  onSelect={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    setHasSelection(target.selectionStart !== target.selectionEnd);
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => setHasSelection(false), 150);
                                  }}
                                  placeholder="Ketik teks di sini (blok teks untuk mewarnai)..."
                                />
                                <div className="flex justify-between items-center mt-2 gap-2">
                                  {/* Toolbar Warna */}
                                  <div className={`flex gap-1.5 transition-all duration-200 ${
                                    hasSelection ? 'opacity-100 pointer-events-auto' : 'opacity-50 pointer-events-none grayscale'
                                  }`}>
                                    <button onClick={() => wrapText('merah')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition shadow-sm">Merah</button>
                                    <button onClick={() => wrapText('kuning')} className="px-3 py-1.5 bg-yellow-400 text-slate-900 rounded-lg text-xs font-bold hover:bg-yellow-500 transition shadow-sm">Kuning</button>
                                    <button onClick={() => wrapText('hijau')} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition shadow-sm">Hijau</button>
                                    <button onClick={() => wrapText('biru')} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition shadow-sm">Biru</button>
                                  </div>

                                  <button 
                                    onClick={() => setIsBgPickerOpen(true)}
                                    className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-indigo-700 bg-white/50 hover:bg-white/80 px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm transition shrink-0"
                                  >
                                    <ImageIcon size={14} /> 
                                    {playlist[activeItem]?.segmentBackgrounds?.[activeSegment] ? 'Ubah Background' : 'Set Background'}
                                  </button>
                                </div>
                              </div>
                            ) : playlist[activeItem]?.segments[activeSegment] ? (
                              <div className="w-full h-full flex flex-col justify-center overflow-hidden bg-white/50 dark:bg-slate-800/50 rounded-xl p-6 border border-white/40 shadow-sm">
                                <div 
                                  className="text-lg md:text-xl whitespace-pre-wrap leading-relaxed text-indigo-900 dark:text-slate-200 text-center w-full"
                                  dangerouslySetInnerHTML={{ __html: processText(playlist[activeItem]?.segments[activeSegment]) }} 
                                />
                              </div>
                            ) : (
                              <span className="text-indigo-900/30 italic text-center w-full">Lirik tidak tersedia</span>
                            )}
                          </div>
                          <div className="w-full lg:w-1/2 flex flex-col justify-center items-center h-full min-h-0">
                            <h4 className="text-sm font-bold text-indigo-900/60 dark:text-slate-400 uppercase mb-2 flex items-center gap-2 shrink-0"><Monitor size={14} /> Live Preview</h4>
                            <div 
                              className="w-full aspect-video bg-black rounded-xl overflow-hidden relative shadow-lg flex items-center justify-center p-2 md:p-4 border-[4px] md:border-[6px] border-slate-800 max-h-full shrink-0"
                              style={{ 
                                containerType: 'inline-size',
                                backgroundImage: currentBg ? `url('${currentBg}')` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            >
                              <div 
                                className="text-white text-center font-bold whitespace-pre-wrap leading-relaxed drop-shadow-xl w-full" 
                                style={{ 
                                  textShadow: '1px 1px 4px rgba(0,0,0,0.8)', 
                                  fontSize: (() => {
                                    const t = playlist[activeItem]?.segments[activeSegment] || '';
                                    if (t.length > 250) return '2cqw';
                                    if (t.length > 180) return '2.5cqw';
                                    if (t.length > 120) return '3cqw';
                                    if (t.length > 70) return '3.5cqw';
                                    if (t.length > 40) return '4cqw';
                                    return '4.5cqw';
                                  })(),
                                  lineHeight: '1.4'
                                }}
                                dangerouslySetInnerHTML={{ __html: processText(playlist[activeItem]?.segments[activeSegment] || 'Pilih slide...') }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
          </div>
          
          <div className="glass-panel p-3 md:p-5 shrink-0 flex justify-between items-center gap-2 md:gap-6 shadow-lg border-white/50 w-full overflow-hidden">
             
             {/* Kumpulan Tombol Bait/Slide */}
             <div className="flex items-center gap-2 overflow-x-auto shrink-1 pb-1 scrollbar-thin scrollbar-thumb-indigo-200">
               {playlist[activeItem]?.segments && playlist[activeItem].segments.length > 1 && (
                 <>
                   {playlist[activeItem].segments.map((_: any, idx: number) => (
                     <button 
                       key={idx}
                       onClick={() => { setActiveSegment(idx); setMode('content'); }}
                       className={`px-3 py-1.5 md:px-4 md:py-2 font-semibold text-xs md:text-sm whitespace-nowrap rounded-lg transition-all duration-200 border shadow-sm hover:-translate-y-0.5 shrink-0 ${
                         activeSegment === idx && mode === 'content' 
                           ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/30' 
                           : 'bg-white/70 text-indigo-900 border-white/50 hover:bg-white/90'
                       }`}
                     >
                       {playlist[activeItem]?.segmentLabels ? playlist[activeItem].segmentLabels[idx] : `Slide ${idx + 1}`}
                     </button>
                   ))}
                 </>
               )}
             </div>

             {/* Tombol Kontrol Navigasi Utama */}
             <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
               <button onClick={handlePrev} className="glass-button bg-white/60 text-indigo-950 flex flex-1 md:flex-none justify-center items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 text-xs md:text-sm hover:bg-white/80 shadow-md rounded-xl shrink-0"><ArrowLeft size={16}/> Mundur</button>
               <button onClick={handleNext} className="glass-button bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-transparent flex flex-1 md:flex-none justify-center items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 text-xs md:text-sm hover:shadow-lg hover:shadow-indigo-500/30 rounded-xl shrink-0">Lanjut <ArrowRight size={16}/></button>
               <div className="w-px h-8 md:h-10 bg-indigo-900/20 mx-1 md:mx-2 shrink-0"></div>
               <button 
                  onClick={() => setMode(m => m === 'blank' ? 'content' : 'blank')} 
                  className={`glass-button flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 text-xs md:text-sm rounded-xl transition-all shadow-md shrink-0 ${mode === 'blank' ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 shadow-slate-900/40' : 'bg-white/60 text-slate-800 hover:bg-white/80'}`}
               >
                 <Square size={14}/> Blank
               </button>
             </div>
          </div>
        </section>
      </main>
      {/* MODAL TAMBAH ITEM (LAGU/AYAT/SLIDE) */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 overflow-hidden">
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-lg w-full border border-white/40 h-[85vh] max-h-[800px] flex flex-col overflow-hidden">
            <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2 shrink-0">
              <Plus size={20} /> Tambah Item ke Rundown
            </h2>
            
            <div className="flex gap-2 mb-4 justify-between items-center shrink-0">
              <div className="flex gap-2 flex-1">
                <button onClick={() => setSearchType('song')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-semibold ${searchType === 'song' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-900 border border-indigo-200'}`}><Music size={14}/> Lagu</button>
                <button onClick={() => setSearchType('bible')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-semibold ${searchType === 'bible' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-900 border border-indigo-200'}`}><BookOpen size={14}/> Ayat</button>
              </div>
              <div className="flex-1">
                <select 
                  className="w-full bg-white/50 border border-indigo-200 rounded-lg px-2 py-2 text-sm text-indigo-900 font-semibold focus:outline-none focus:border-indigo-500 transition"
                  value={searchType === 'song' ? selectedSongVersion : selectedBibleVersion}
                  onChange={(e) => searchType === 'song' ? setSelectedSongVersion(e.target.value) : setSelectedBibleVersion(e.target.value)}
                >
                  {dbList.filter(d => d.type === searchType).map(db => (
                    <option key={db.id} value={db.id}>{db.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 mb-4 shrink-0">
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

            {searchResults.length === 0 && !isSearching && searchQuery === '' && searchType === 'song' && (
              <div className="flex justify-center gap-2 mb-2 shrink-0">
                <button onClick={() => setViewMode('grid')} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-900 border border-indigo-200'}`}>Nomor Saja</button>
                <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-900 border border-indigo-200'}`}>Nomor & Judul</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-2 mb-4 border border-indigo-100 rounded-xl p-2 bg-slate-50/50">
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
                <div className="p-1">
                  {searchType === 'song' ? (
                    <>
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-6 gap-1.5">
                          {Array.from({length: 525}, (_, i) => i + 1).map(num => (
                            <button 
                              key={num}
                              onClick={() => handleQuickAddSong(num.toString())}
                              className="py-2 px-1 text-center text-xs font-semibold text-indigo-900 bg-white/40 border border-white/20 rounded-md hover:bg-indigo-600 hover:text-white transition shadow-sm"
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {allSongTitles ? allSongTitles.map((song: any) => (
                            <button 
                              key={song.id}
                              onClick={() => handleQuickAddSong(song.id.toString())}
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
                    <div className="grid grid-cols-2 gap-1.5">
                      {bibleBooks.map(book => (
                        <button 
                          key={book}
                          onClick={() => {
                            setSearchQuery(book + " ");
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

            <div className="flex justify-between items-center mt-2 border-t pt-4 border-indigo-100 shrink-0">
              <div className="flex items-center gap-3">
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
                
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-900 bg-white/40 px-3 py-2 rounded-xl border border-white/40 hover:bg-white/60 transition shadow-sm">
                  <input 
                    type="checkbox" 
                    checked={isAutoSplitEnabled}
                    onChange={toggleAutoSplit}
                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  Auto-Split Teks
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
      <BackgroundPickerModal 
        isOpen={isBgModalOpen} 
        onClose={() => setIsBgModalOpen(false)} 
        onSelect={handleGlobalBackgroundSelect} 
        currentBgUrl={localStorage.getItem('custom_bg')} 
      />

      {/* LOGO MODAL */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-2xl w-full border border-white/40 dark:border-slate-700 max-h-[90vh] flex flex-col">
            
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-100 mb-2">Logo & Watermark</h2>
              <p className="text-sm text-indigo-800/70 dark:text-indigo-200/70 mb-4">Tambahkan logo dan geser (drag) di dalam kotak hitam untuk mengatur posisinya.</p>
              
              <div 
                ref={containerRef}
                className="w-full aspect-video bg-slate-900 rounded-xl relative overflow-hidden shadow-inner border-[6px] border-slate-800 dark:border-slate-950 select-none"
              >
                {logos.map(logo => (
                  <div
                    key={logo.id}
                    className="absolute cursor-move group"
                    style={{ 
                      left: `${logo.x}%`, 
                      top: `${logo.y}%`, 
                      width: `${8 * logo.scale}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: activeDragLogo === logo.id ? 50 : 10
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setActiveDragLogo(logo.id);
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (activeDragLogo !== logo.id || !containerRef.current) return;
                      const rect = containerRef.current.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                      updateLogo(logo.id, { x, y });
                    }}
                    onPointerUp={(e) => {
                      if (activeDragLogo === logo.id) {
                        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        setActiveDragLogo(null);
                      }
                    }}
                  >
                    <img src={logo.url} alt="Logo" className="w-full h-auto opacity-80 pointer-events-none group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 border-2 border-indigo-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity rounded-sm border-dashed"></div>
                  </div>
                ))}
                {logos.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-semibold italic">Belum ada logo</div>
                )}
              </div>

              <div className="mt-4 space-y-3 pb-4">
              {logos.map((logo, index) => (
                <div key={logo.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Logo {index + 1}</span>
                    <button onClick={() => removeLogo(logo.id)} className="text-red-500 hover:text-red-700 bg-red-100 dark:bg-red-900/30 p-1 rounded transition-colors" title="Hapus"><X size={14}/></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold w-16 dark:text-slate-300">Ukuran:</span>
                    <input 
                      type="range" 
                      min="0.1" max="5" step="0.1" 
                      value={logo.scale} 
                      onChange={(e) => updateLogo(logo.id, { scale: parseFloat(e.target.value) })}
                      className="flex-1 accent-indigo-600 h-2 bg-indigo-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-8">{Math.round(logo.scale * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
            </div>
            
            <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" />
            
            <div className="flex gap-3 mt-2 pt-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <button onClick={() => logoInputRef.current?.click()} className="flex-1 py-3 rounded-xl font-bold text-indigo-900 dark:text-indigo-100 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-800/40 border border-indigo-200 dark:border-indigo-800 flex justify-center items-center gap-2 transition shadow-sm">
                <Plus size={18} /> Tambah Logo
              </button>
              <button onClick={() => setIsLogoModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition">
                Selesai & Tutup
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

      {/* COUNTDOWN MODAL */}
      {isCountdownModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/40 flex flex-col">
            <h2 className="text-2xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <Clock size={24} /> Tambah Hitung Mundur
            </h2>
            <form onSubmit={handleCountdownSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-bold text-indigo-900/70 mb-2">
                  Masukkan durasi (misal: 5 untuk 5 menit, 30s untuk 30 detik, 5m 30s)
                </label>
                <input 
                  autoFocus
                  className="w-full text-lg bg-white border-2 border-indigo-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium"
                  value={countdownInputValue}
                  onChange={(e) => setCountdownInputValue(e.target.value)}
                  placeholder="5m 30s"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsCountdownModalOpen(false)} className="px-6 py-2 rounded-xl font-bold text-indigo-900 bg-black/5 hover:bg-black/10 transition">Batal</button>
                <button type="submit" className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition">Tambahkan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pilih Background Per Slide */}
      <BackgroundPickerModal
        isOpen={isBgPickerOpen}
        onClose={() => setIsBgPickerOpen(false)}
        currentBgUrl={playlist[activeItem]?.segmentBackgrounds?.[activeSegment]}
        onSelect={(url) => {
          const newPlaylist = [...playlist];
          if (!newPlaylist[activeItem].segmentBackgrounds) {
            newPlaylist[activeItem].segmentBackgrounds = [];
          }
          newPlaylist[activeItem].segmentBackgrounds[activeSegment] = url;
          setPlaylist(newPlaylist);
        }}
      />
    </div>
  );
}
