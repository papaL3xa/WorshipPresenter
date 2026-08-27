import { useState, useEffect, useRef } from 'react';
import { Monitor, Square, Play, Pause, ArrowRight, ArrowLeft, Loader2, Image as ImageIcon, Video, CheckCircle, Type, Plus, Trash2, Edit, Save, Search, Music, BookOpen, Settings, CheckSquare, X, RefreshCw, Clock, Layout, Power, FileText, Repeat, Volume2, VolumeX } from 'lucide-react';
import { callApi } from '../api';
import { SyncButton } from '../components/SyncButton';
import { useBackgrounds } from '../hooks/useBackgrounds';
import YouTube from 'react-youtube';
import { BackgroundPickerModal, BackgroundPickerInline } from '../components/BackgroundPickerModal';
import { saveLocalVideo, saveLocalImage } from '../utils/imageStorage';
import { FooterClock } from '../components/FooterClock';
import { ThemeToggle } from '../components/ThemeToggle';
import { RichEditor, RichEditorRef } from '../components/RichEditor';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import { LocalImageLoader } from '../components/LocalImageLoader';
import { initDefaultDatabases, searchLocalSongs, searchLocalBible, syncCustomSongs, getDatabaseList, DatabaseVersion, getAllLocalSongTitles, getBibleBooksList } from '../utils/dbStorage';

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


import { useLocation, useNavigate } from 'react-router-dom';
import { globalDisplayWindow, globalIsDisplayOpen, setGlobalDisplayWindow, setGlobalIsDisplayOpen } from '../utils/displayState';

export default function ControlPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const urlId = searchParams.get('id');
  
  const [playlistId] = useState<string | null>(urlId === 'new' ? 'pl_' + Date.now() : urlId);
  const [playlistDate, setPlaylistDate] = useState(new Date().toISOString().split('T')[0]);
  const [localVidLoaded, setLocalVidLoaded] = useState(false);

  const [playlist, setPlaylist] = useState<any[]>([]);
  const [playlistName, setPlaylistName] = useState('Memuat...');
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeItem, setActiveItem] = useState(0);
  const [activeSegment, setActiveSegment] = useState(0);
  const [liveItem, setLiveItem] = useState(0);
  const [liveSegment, setLiveSegment] = useState(0);
  const [mode, setMode] = useState<'content' | 'blank' | 'logo'>('content');
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isBgPickerOpen, setIsBgPickerOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [displayPanelTab, setDisplayPanelTab] = useState<string>('rt');
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

  const [isEditingRundown, setIsEditingRundown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dragItem, setDragItem] = useState<number | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const editorRef = useRef<RichEditorRef>(null);
  
  const [activeDragLogo, setActiveDragLogo] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [allSongTitles, setAllSongTitles] = useState<{id: string, title: string}[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [liveCountdown, setLiveCountdown] = useState<{id: string, start: number, duration: number} | null>(null);
  const [previewCountdown, setPreviewCountdown] = useState<number | null>(null);
  const [tempLiveItem, setTempLiveItem] = useState<any>(null);
  
  const [dbList, setDbList] = useState<DatabaseVersion[]>([]);
  const [selectedSongVersion, setSelectedSongVersion] = useState('song_LSEB');
  const [selectedBibleVersion, setSelectedBibleVersion] = useState('bible_TB');
  
  const [currentBg, setCurrentBg] = useState(localStorage.getItem('custom_bg') || '');
  const { getBgUrl, refreshBackgrounds } = useBackgrounds();

  // Initialize DBs on mount
  useEffect(() => {
    initDefaultDatabases().then(() => {
      getDatabaseList().then(setDbList);
      syncCustomSongs(); // Sync background
    });
  }, []);

  // Segment Edit State
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null);
  const [editSegmentIndex, setEditSegmentIndex] = useState<number>(0);
  const [segmentEditIndex, setSegmentEditIndex] = useState<number | null>(null);
  const [tempVisibleSegments, setTempVisibleSegments] = useState<number[]>([]);

  
  // Running Text States
  const [runningText, setRunningText] = useState(localStorage.getItem(`worship_rt_text_${playlistId}`) || localStorage.getItem('worship_rt_text') || '');
  const [rtPos, setRtPos] = useState(localStorage.getItem('worship_rt_pos') || 'bottom');
  const [rtSpeed, setRtSpeed] = useState(Number(localStorage.getItem('worship_rt_speed') || 15));
  const [rtHeight, setRtHeight] = useState(Number(localStorage.getItem('worship_rt_height') || 7));
  const [isRtVisible, setIsRtVisible] = useState(false);
  
  // Add Item States
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'song'|'bible'|'announcement'>('song');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentBibleBooks, setCurrentBibleBooks] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annSegments, setAnnSegments] = useState<string[]>(['']);
  const [annActiveSegment, setAnnActiveSegment] = useState(0);

  const [isDisplayOpen, setIsDisplayOpen] = useState(globalIsDisplayOpen);
  const displayWindowRef = useRef<Window | null>(globalDisplayWindow);
  const ytPlayerRef = useRef<any>(null);

  useEffect(() => {
    setGlobalDisplayWindow(displayWindowRef.current);
    setGlobalIsDisplayOpen(isDisplayOpen);
  }, [isDisplayOpen]);

  // Broadcast running text whenever its state changes
  useEffect(() => {
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ 
      type: 'RUNNING_TEXT_UPDATE', 
      payload: { text: runningText, position: rtPos, speed: rtSpeed, isVisible: isRtVisible, height: rtHeight } 
    });
    channel.close();
  }, [playlistId, runningText, rtPos, rtSpeed, isRtVisible, rtHeight]);

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
    if (isRunningTextModalOpen && displayPanelTab === 'add') {
      if (searchType === 'song') {
        getAllLocalSongTitles(selectedSongVersion).then(res => {
          if (Array.isArray(res)) setAllSongTitles(res);
        }).catch(err => console.error("Gagal memuat judul lagu", err));
      } else if (searchType === 'bible') {
        getBibleBooksList(selectedBibleVersion).then(res => {
          if (Array.isArray(res)) setCurrentBibleBooks(res);
        }).catch(err => console.error("Gagal memuat daftar kitab", err));
      }
    }
  }, [isRunningTextModalOpen, displayPanelTab, searchType, selectedSongVersion, selectedBibleVersion]);

  
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
          let rawItems = res.data.items;
          if (typeof rawItems === 'string') {
            try { rawItems = JSON.parse(rawItems); } catch(e) {}
          }
          if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
            rawItems = Array.isArray(rawItems.items) ? rawItems.items : Object.values(rawItems).filter(v => typeof v === 'object' && v !== null);
          }
          if (!Array.isArray(rawItems)) rawItems = [];
          
          const itemsWithVisibleSegments = rawItems.map((item: any) => {
            if ((item.type === 'song' || item.type === 'bible') && item.customText) {
              try {
                item.visibleSegments = JSON.parse(item.customText);
              } catch (e) {
                // ignore
              }
            }
            return item;
          });
          setPlaylist(itemsWithVisibleSegments);
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

  const [videoProgress, setVideoProgress] = useState<{currentTime: number, duration: number} | null>(null);
  const [videoState, setVideoState] = useState<'play'|'pause'>('pause');

  useEffect(() => {
    const channel = new BroadcastChannel('worship_live_sync');
    channel.onmessage = (msg) => {
      if (msg.data.type === 'VIDEO_PROGRESS') {
        setVideoProgress(msg.data.payload);
      } else if (msg.data.type === 'VIDEO_STATE') {
        setVideoState(msg.data.payload);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    // Sync preview HTML5 video state
    const vid = document.getElementById('preview-video') as HTMLVideoElement;
    const localVidContainer = document.getElementById('preview-video-container');
    const localVid = localVidContainer?.querySelector('video') as HTMLVideoElement;
    const targetVid = vid || localVid;
    if (targetVid) {
      if (mode === 'content' && videoState === 'play') {
        targetVid.play().catch(e => console.error("ControlPanel play error:", e));
      } else {
        targetVid.pause();
      }
    }
    
    // Sync preview YouTube iframe state
    if (ytPlayerRef.current) {
      if (mode === 'content' && videoState === 'play') {
        ytPlayerRef.current.playVideo?.();
      } else {
        ytPlayerRef.current.pauseVideo?.();
      }
    }
  }, [mode, videoState, localVidLoaded]);

  useEffect(() => {
    if (!videoProgress) return;
    const vid = document.getElementById('preview-video') as HTMLVideoElement;
    const localVidContainer = document.getElementById('preview-video-container');
    const localVid = localVidContainer?.querySelector('video') as HTMLVideoElement;
    const targetVid = vid || localVid;
    if (targetVid) {
      if (Math.abs(targetVid.currentTime - videoProgress.currentTime) > 1.5) {
        targetVid.currentTime = videoProgress.currentTime;
      }
    }
    
    // Sync YouTube iframe
    if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function' && Math.abs(ytPlayerRef.current.getCurrentTime() - videoProgress.currentTime) > 1.5) {
      ytPlayerRef.current.seekTo?.(videoProgress.currentTime, true);
    }
  }, [videoProgress]);

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'VIDEO_SEEK', payload: { time } });
    channel.close();
    setVideoProgress(prev => prev ? { ...prev, currentTime: time } : null);
    
    const vid = document.getElementById('preview-video') as HTMLVideoElement;
    const localVidContainer = document.getElementById('preview-video-container');
    const localVid = localVidContainer?.querySelector('video') as HTMLVideoElement;
    const targetVid = vid || localVid;
    if (targetVid) {
      targetVid.currentTime = time;
    }
    
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo?.(time, true);
    }
  };

  const toggleVideoPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const channel = new BroadcastChannel('worship_live_sync');
    if (videoState === 'play') {
      channel.postMessage({ type: 'VIDEO_PAUSE' });
      setVideoState('pause');
    } else {
      channel.postMessage({ type: 'VIDEO_PLAY' });
      setVideoState('play');
    }
    channel.close();
  };

  const toggleVideoLoop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeItem < 0 || activeItem >= playlist.length) return;
    const item = playlist[activeItem];
    if (item.type !== 'video') return;
    
    const newVal = !(item.loop);
    const updatedItem = { ...item, loop: newVal };
    
    const newPlaylist = [...playlist];
    newPlaylist[activeItem] = updatedItem;
    setPlaylist(newPlaylist);
    
    if (activeItem === liveItem) {
      const stateObj = {
        playlistId,
        currentItemId: updatedItem.id,
        segmentIndex: liveSegment,
        displayMode: mode,
        item: updatedItem,
        updatedAt: Date.now()
      };
      const channel = new BroadcastChannel('worship_live_sync');
      channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
      channel.close();
      
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(async () => {
        try { await callApi('setLiveState', {}, { method: 'POST', payload: stateObj }); } catch (err) {}
      }, 200);
    }
  };

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeItem < 0 || activeItem >= playlist.length) return;
    const item = playlist[activeItem];
    if (item.type !== 'video') return;
    
    const newVal = !(item.muted);
    const updatedItem = { ...item, muted: newVal };
    
    const newPlaylist = [...playlist];
    newPlaylist[activeItem] = updatedItem;
    setPlaylist(newPlaylist);
    
    if (activeItem === liveItem) {
      const stateObj = {
        playlistId,
        currentItemId: updatedItem.id,
        segmentIndex: liveSegment,
        displayMode: mode,
        item: updatedItem,
        updatedAt: Date.now()
      };
      const channel = new BroadcastChannel('worship_live_sync');
      channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
      channel.close();
      
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(async () => {
        try { await callApi('setLiveState', {}, { method: 'POST', payload: stateObj }); } catch (err) {}
      }, 200);
    }
  };

  const formatVideoTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  // Fungsi push ke Live tapi sementara (tanpa masuk rundown)
  const pushTempToLive = (item: any, segIdx: number = 0) => {
    if (!item.type) item.type = item.book ? 'bible' : 'song';
    const processedItem = item;
    
    setTempLiveItem(processedItem);
    setLiveSegment(segIdx);
    const dispMode = processedItem.type === 'video' ? 'logo' : 'content';
    setMode(dispMode);
    
    const stateObj = {
      playlistId: playlistId,
      currentItemId: processedItem.id || ('temp-' + Date.now()),
      segmentIndex: segIdx,
      displayMode: dispMode,
      item: processedItem,
      updatedAt: Date.now()
    };
    
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
    channel.close();
  };


  // Fungsi untuk push state ke GAS
  const pushStateToLive = async (itemIdx: number, segIdx: number, dispMode: string) => {
    setTempLiveItem(null);
    // Jika mode blank/content, selalu broadcast meski playlist kosong
    if (playlist.length === 0) {
      // Hanya broadcast displayMode saja (tanpa item)
      const channel = new BroadcastChannel('worship_live_sync');
      channel.postMessage({ type: 'STATE_UPDATE', state: { displayMode: dispMode, updatedAt: Date.now() } });
      channel.close();
      return;
    }

    setIsSyncing(true);
    setLiveItem(itemIdx);
    setLiveSegment(segIdx);
    setActiveItem(itemIdx);
    setActiveSegment(segIdx);
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

    if (playlist[itemIdx].type === 'video') {
      setVideoState('pause');
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
  const [isVideoLoop, setIsVideoLoop] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const openVideoModal = (index: number | null = null) => {
    if (index !== null) {
      setReplaceIndex(index);
      if (playlist[index]?.type === 'video') {
        setVideoUrlInput(playlist[index].segments[0] || '');
        setIsVideoLoop(!!playlist[index].loop);
        setIsVideoMuted(!!playlist[index].muted);
      } else {
        setVideoUrlInput('');
        setIsVideoLoop(false);
        setIsVideoMuted(false);
      }
    } else {
      setVideoUrlInput('');
      setIsVideoLoop(false);
      setIsVideoMuted(false);
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
      loop: isVideoLoop,
      muted: isVideoMuted
    } as any;
    
    let finalPlaylist = [];
    let targetIdx = 0;
    if (replaceIndex !== null) {
      finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newItem;
      targetIdx = replaceIndex;
      setPlaylist(finalPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      finalPlaylist = [...playlist, newItem];
      targetIdx = playlist.length;
      setPlaylist(finalPlaylist);
      setActiveItem(targetIdx);
    }
    
    setIsVideoModalOpen(false);
    setIsAddItemModalOpen(false);
    setIsEditingRundown(false);

    setMode('content');
    setLiveItem(targetIdx);
    setLiveSegment(0);
    setActiveSegment(0);
    setVideoState('pause');
  };

  const handleRundownImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const selectedFiles = Array.from(files).slice(0, 2);
    
    const imageInfos = await Promise.all(selectedFiles.map(file => {
      return new Promise<{url: string, width: number, height: number, file: File}>((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          resolve({ url, width: img.width, height: img.height, file });
        };
        img.src = url;
      });
    }));

    const segments: string[] = [];
    const savedIds: string[] = [];

    for (const info of imageInfos) {
      const id = 'img-' + Date.now() + Math.floor(Math.random() * 1000);
      await saveLocalImage(id, info.file);
      savedIds.push(`local_img_${id}`);
    }

    if (imageInfos.length === 2) {
      const allPortrait = imageInfos.every(info => info.width < info.height);
      if (allPortrait) {
        segments.push(JSON.stringify(savedIds));
      } else {
        segments.push(savedIds[0], savedIds[1]);
      }
    } else {
      segments.push(savedIds[0]);
    }

    const newItem = {
      id: 'image-' + Date.now(),
      type: 'image',
      title: 'Gambar',
      segments: segments
    } as any;
    
    let finalPlaylist = [];
    let targetIdx = 0;
    if (replaceIndex !== null) {
      finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newItem;
      targetIdx = replaceIndex;
      setPlaylist(finalPlaylist);
      setActiveItem(replaceIndex);
      setReplaceIndex(null);
    } else {
      finalPlaylist = [...playlist, newItem];
      targetIdx = playlist.length;
      setPlaylist(finalPlaylist);
      setActiveItem(targetIdx);
    }

    setIsAddItemModalOpen(false);
    setIsEditingRundown(false);
    setMode('content');
    setLiveItem(targetIdx);
    setLiveSegment(0);
    setActiveSegment(0);

    const stateObj = {
      playlistId,
      currentItemId: newItem.id,
      segmentIndex: 0,
      displayMode: 'content',
      item: newItem,
      updatedAt: Date.now()
    };
    
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
    channel.close();
    
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(async () => {
      try { await callApi('setLiveState', {}, { method: 'POST', payload: stateObj }); } catch (err) {}
    }, 200);

    e.target.value = '';
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
          segmentOrder: item.isRange ? item.segments.map((_:any, i:number) => i) : [0],
          segmentLabels: item.isRange ? item.segmentLabels : [`Ayat ${item.verse}`]
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

  const addToRundown = (item: any, playLive: boolean = false) => {
    // Add type if missing
    if (!item.type) {
      item.type = item.book ? 'bible' : 'song';
    }
    
    // Process segments for long texts
    const processedItem = item;
    
    const newItem = { ...processedItem, localId: Math.random().toString(36).substr(2, 9) };
    let targetIndex = 0;
    if (replaceIndex !== null) {
      const finalPlaylist = [...playlist];
      finalPlaylist[replaceIndex] = newItem;
      setPlaylist(finalPlaylist);
      targetIndex = replaceIndex;
      setReplaceIndex(null);
    } else {
      const finalPlaylist = [...playlist];
      let newIndex = finalPlaylist.length;
      if (activeItem !== null && activeItem >= 0 && activeItem < finalPlaylist.length) {
        newIndex = activeItem + 1;
        finalPlaylist.splice(newIndex, 0, newItem);
      } else {
        finalPlaylist.push(newItem);
      }
      targetIndex = newIndex;
      setPlaylist(finalPlaylist);
    }
    
    setActiveItem(targetIndex);
    setActiveSegment(0);
    setIsAddItemModalOpen(false);
    setIsEditingRundown(true);
    
    if (playLive) {
      const newMode = item.type === 'video' ? 'logo' : 'content';
      setMode(newMode);
      setTimeout(() => {
        pushStateToLive(targetIndex, 0, newMode);
      }, 50);
    }
  };

  const handleQuickAddSong = async (id: string, playLive: boolean = false) => {
    try {
      setIsSearching(true);
      const res = await searchLocalSongs(id, selectedSongVersion);
      if (res && res.length > 0) {
        // Find exact match just in case
        const exact = res.find((s: any) => s.id == id) || res[0];
        exact.type = 'song'; // Ensure type is explicitly set
        const processed = exact;
        
        if (playLive) {
          pushTempToLive(processed);
        } else {
          addToRundown(processed);
        }
        
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengambil data lagu');
    } finally {
      setIsSearching(false);
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
        if (item.type === 'announcement') customText = item.segments.join('\n\n---\n\n');
        if (item.type === 'video') customText = item.segments[0];
        if (item.type === 'song' || item.type === 'bible') customText = item.visibleSegments ? JSON.stringify(item.visibleSegments) : '';
        
        localItem.customText = customText;
        localItem.refId = (item.type === 'announcement' || item.type === 'video') ? item.title : (item.refId || item.id);
        
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
  const prevActiveItemRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!isEditingRundown && activeItem !== null && playlist[activeItem]) {
      if (prevActiveItemRef.current !== activeItem) {
        setMode('content');
        prevActiveItemRef.current = activeItem;
      }
      
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
    }
  }, [activeItem, activeSegment, mode, playlist, isEditingRundown]);

  const wrapText = (colorTag: string) => {
    let hex = '#ef4444';
    if (colorTag === 'kuning') hex = '#eab308';
    if (colorTag === 'hijau') hex = '#22c55e';
    if (colorTag === 'biru') hex = '#3b82f6';
    if (colorTag === 'ungu') hex = '#c084fc';
    if (colorTag === 'oranye') hex = '#fb923c';
    if (colorTag === 'putih') hex = '#ffffff';
    if (colorTag === 'hitam') hex = '#000000';

    if (editorRef.current) {
      editorRef.current.applyColor(colorTag, hex);
    }
  };

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
      
      // Sinkronisasi data ke display yang baru dibuka setelah delay singkat
      setTimeout(() => {
        const channel = new BroadcastChannel('worship_live_sync');
        
        // 1. Sync State
        const activeItemData = tempLiveItem ? tempLiveItem : playlist[liveItem];
        if (activeItemData) {
          const stateObj = {
            playlistId: playlistId,
            currentItemId: activeItemData.id || ('temp-' + Date.now()),
            segmentIndex: liveSegment,
            displayMode: mode,
            item: activeItemData,
            updatedAt: Date.now()
          };
          channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
        }

        // 2. Sync Running Text
        channel.postMessage({ 
          type: 'RUNNING_TEXT_UPDATE', 
          payload: { text: runningText, position: rtPos, speed: rtSpeed, isVisible: isRtVisible, height: rtHeight } 
        });

        // 3. Sync Background
        channel.postMessage({ type: 'BG_UPDATE', bg: currentBg || '' });

        // 4. Sync Logos
        const savedLogos = localStorage.getItem('worship_logos_array');
        if (savedLogos) {
          try {
            channel.postMessage({ type: 'LOGOS_UPDATE', payload: JSON.parse(savedLogos) });
          } catch(e) {}
        }

        channel.close();
      }, 1500);
    }
  };

  const handleGlobalBackgroundSelect = (bgUrl: string | null) => {
    try {
      if (bgUrl === null) {
        localStorage.removeItem('custom_bg');
        setCurrentBg('');
        refreshBackgrounds();
      } else {
        localStorage.setItem('custom_bg', bgUrl);
        setCurrentBg(bgUrl);
        refreshBackgrounds();
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
      if (file.size > 3.5 * 1024 * 1024) {
        alert('Ukuran file logo terlalu besar. Maksimal 3.5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newLogo = { id: 'logo-' + Date.now(), url: base64, x: 50, y: 50, scale: 1, enabled: true };
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
    localStorage.setItem(`worship_rt_text_${playlistId}`, runningText);
    localStorage.setItem('worship_rt_pos', rtPos);
    localStorage.setItem('worship_rt_speed', String(rtSpeed));
    localStorage.setItem('worship_rt_height', String(rtHeight));
    setIsRtVisible(visible);

    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({
      type: 'RUNNING_TEXT_UPDATE',
      payload: { text: runningText, position: rtPos, speed: rtSpeed, height: rtHeight, isVisible: visible }
    });
    channel.close();
  };

  const getNextSlideInfo = () => {
    if (tempLiveItem) {
      const segs = tempLiveItem.segments || [];
      if (liveSegment < segs.length - 1) {
        return { item: -2, segment: liveSegment + 1 };
      }
      return { item: -1, segment: -1 };
    }
    if (playlist.length === 0) return { item: -1, segment: -1 };
    const item = playlist[activeItem];
    if (!item) return { item: -1, segment: -1 };
    const visible = item.visibleSegments || [...Array(item.segments?.length || 1).keys()];
    const currentIdx = visible.indexOf(activeSegment);

    if (currentIdx !== -1 && currentIdx < visible.length - 1) {
      return { item: activeItem, segment: visible[currentIdx + 1] };
    } else if (activeItem < playlist.length - 1) {
      const nextItemIdx = activeItem + 1;
      const nextItem = playlist[nextItemIdx];
      const nextVisible = nextItem.visibleSegments || [...Array(nextItem.segments?.length || 1).keys()];
      const nextSeg = nextVisible.length > 0 ? nextVisible[0] : 0;
      return { item: nextItemIdx, segment: nextSeg };
    }
    return { item: -1, segment: -1 };
  };

  const handleNext = () => {
    if (tempLiveItem) {
      const segs = tempLiveItem.segments || [];
      if (liveSegment < segs.length - 1) {
        pushTempToLive(tempLiveItem, liveSegment + 1);
      }
      return;
    }
    if (playlist.length === 0) return;
    const item = playlist[activeItem];
    const visible = item?.visibleSegments || [...Array(item?.segments?.length || 1).keys()];
    const currentIdx = visible.indexOf(activeSegment);

    if (currentIdx !== -1 && currentIdx < visible.length - 1) {
      const nextSeg = visible[currentIdx + 1];
      setActiveSegment(nextSeg);
      pushStateToLive(activeItem, nextSeg, mode);
    } else if (activeItem < playlist.length - 1) {
      const nextItemIdx = activeItem + 1;
      setActiveItem(nextItemIdx);
      const nextItem = playlist[nextItemIdx];
      const nextVisible = nextItem?.visibleSegments || [...Array(nextItem?.segments?.length || 1).keys()];
      const nextSeg = nextVisible.length > 0 ? nextVisible[0] : 0;
      setActiveSegment(nextSeg);
      pushStateToLive(nextItemIdx, nextSeg, 'content');
    }
  };

  const handlePrev = () => {
    if (tempLiveItem) {
      if (liveSegment > 0) {
        pushTempToLive(tempLiveItem, liveSegment - 1);
      }
      return;
    }
    if (playlist.length === 0) return;
    const item = playlist[activeItem];
    const visible = item?.visibleSegments || [...Array(item?.segments?.length || 1).keys()];
    const currentIdx = visible.indexOf(activeSegment);

    if (currentIdx > 0) {
      const prevSeg = visible[currentIdx - 1];
      setActiveSegment(prevSeg);
      pushStateToLive(activeItem, prevSeg, mode);
    } else if (activeItem > 0) {
      const prevItemIdx = activeItem - 1;
      setActiveItem(prevItemIdx);
      const prevItem = playlist[prevItemIdx];
      const prevVisible = prevItem?.visibleSegments || [...Array(prevItem?.segments?.length || 1).keys()];
      const prevSeg = prevVisible.length > 0 ? prevVisible[prevVisible.length - 1] : 0;
      setActiveSegment(prevSeg);
      pushStateToLive(prevItemIdx, prevSeg, 'content');
    }
  };

  // Keyboard / Presentation Pointer support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contentEditable div
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
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

    const channel = new BroadcastChannel('worship_live_sync');
    const handleRemoteKey = (e: MessageEvent) => {
      if (e.data && e.data.type === 'REMOTE_KEYDOWN') {
        const fakeEvent = { key: e.data.key, preventDefault: () => {} } as KeyboardEvent;
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


  const renderDisplayBox = (itemIdx: number, segIdx: number, isLiveBox: boolean) => {
    const itemData = ((isLiveBox && tempLiveItem) || itemIdx === -2) ? tempLiveItem : playlist[itemIdx];
    if (!itemData) return <div className="w-full h-full bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center pointer-events-none"></div>;
    return (
      <div className="w-full h-full bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center pointer-events-none"
        style={getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.type === 'image' ? { 
          containerType: 'inline-size',
          backgroundImage: getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url ? `url('${getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url}')` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : { containerType: 'inline-size' }}
      >
        {getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.type === 'video' && (
          <video 
            src={getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        <div className="absolute inset-0 bg-black/40 z-0"></div>

        {/* Image Preview */}
        {mode === 'content' && itemData?.type === 'image' && itemData?.segments[segIdx] && (
          <div className="absolute inset-0 z-[5] bg-black flex items-center justify-center">
            {(() => {
              try {
                const urls = JSON.parse(itemData.segments[segIdx]);
                if (Array.isArray(urls)) {
                  return (
                    <div className="flex w-full h-full gap-4 p-4 items-center justify-center">
                      {urls.map((url: string, i: number) => (
                        <div key={i} className="flex-1 h-full relative">
                          <LocalImageLoader id={url} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  );
                }
              } catch (e) {
                // If it fails to parse, it's just a single URL string
              }
              return <LocalImageLoader id={itemData.segments[segIdx]} className="w-full h-full object-contain" />;
            })()}
          </div>
        )}

        {/* Video Preview */}
        {mode === 'content' && itemData?.type === 'video' && itemData?.segments[segIdx] && (
          <div className="absolute inset-0 z-[5] bg-black flex items-center justify-center">
            {(() => {
              const url = itemData.segments[segIdx];
              const isPlay = mode === 'content';
              let videoId = '';
              if (url.includes('youtube.com') || url.includes('youtu.be')) {
                  if (url.includes('v=')) {
                    videoId = url.split('v=')[1].split('&')[0];
                  } else if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1].split('?')[0];
                  } else if (url.includes('youtube.com/embed/') || url.includes('youtube-nocookie.com/embed/')) {
                    videoId = url.split('embed/')[1].split('?')[0];
                  }
                
                if (videoId) {
                  return (
                    <YouTube
                      videoId={videoId}
                      opts={{
                        height: '100%',
                        width: '100%',
                        playerVars: { autoplay: isPlay ? 1 : 0, mute: 1, controls: 0, disablekb: 1, enablejsapi: 1, loop: itemData.loop ? 1 : 0, playlist: itemData.loop ? videoId : undefined }
                      }}
                      className="w-full h-full object-contain"
                      onReady={(e: any) => ytPlayerRef.current = e.target}
                    />
                  );
                }
                return <iframe id="preview-youtube" key={url} className="w-full h-full object-contain" src={url} allow="autoplay; encrypted-media" tabIndex={-1} />;
              }
              if (url.startsWith('local_vid_')) {
                return (
                  <div id="preview-video-container" className="w-full h-full">
                    <LocalVideoPlayer key={`${url}-${mode}`} id={url} loop={itemData.loop || false} autoPlay={false} muted={true} onLoadedData={() => setLocalVidLoaded(v => !v)} />
                  </div>
                );
              }
              return <video id="preview-video" key={`${url}-${mode}`} className="w-full h-full object-contain" src={url} muted={true} autoPlay={false} loop={itemData.loop || false} />;
            })()}
          </div>
        )}
        
        {/* Safe Area Container untuk Logo, Judul, dan Teks agar tidak tertimpa Running Text */}
        <div 
          className="absolute left-0 right-0 z-20 flex flex-col items-center justify-center pointer-events-none transition-all duration-500"
          style={{
            top: isRtVisible && rtPos === 'top' ? `${((rtHeight || 7) / 56.25 * 100)}%` : '0',
            bottom: isRtVisible && rtPos === 'bottom' ? `${((rtHeight || 7) / 56.25 * 100)}%` : '0'
          }}
        >
        
        {/* Multi-Logos */}
        {logos.length > 0 && itemData?.type !== 'countdown' && (
          <div className="absolute inset-0 pointer-events-none z-[60]">
            {logos.filter(l => l.enabled !== false).map(logo => (
              <img 
                key={logo.id}
                src={logo.url} 
                style={{ 
                  width: `${8 * logo.scale}%`,
                  ...(logo.x < 50 ? { left: `${logo.x}%` } : { right: `${100 - logo.x}%` }),
                  ...(logo.y < 50 ? { top: `${logo.y}%` } : { bottom: `${100 - logo.y}%` }),
                }}
                className="absolute h-auto opacity-70 z-10"
                alt="Logo" 
              />
            ))}
          </div>
        )}

        {/* Title */}
        {mode === 'content' && itemData?.title && itemData?.type !== 'video' && itemData?.type !== 'countdown' && itemData?.type !== 'image' && (
          <h2 
            className="absolute left-0 right-0 w-full px-4 text-center font-heading font-bold text-yellow-300 opacity-90 tracking-wider z-20 transition-all duration-500"
            style={{
              top: '6%',
              fontSize: '1.5cqw',
              textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 10px rgba(0,0,0,0.9)'
            }}
          >
            {itemData?.title}
          </h2>
        )}

        {/* Content Container */}
        {itemData?.type !== 'video' && itemData?.type !== 'image' && (
          <div className="absolute top-[18%] bottom-[12%] left-0 right-0 z-10 flex flex-col items-center justify-center w-full px-[8%]">
            {itemData?.type === 'countdown' ? (
               <div className="text-white text-center font-bold tracking-widest leading-none drop-shadow-xl w-full font-mono" 
                    style={{ textShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.2)', fontSize: '18cqw' }}>
                 {(() => {
                   const displaySecs = previewCountdown !== null ? previewCountdown : parseInt(itemData?.segments[0] || '0');
                   return `${Math.floor(displaySecs / 60).toString().padStart(2, '0')}:${(displaySecs % 60).toString().padStart(2, '0')}`;
                 })()}
               </div>
            ) : mode === 'content' ? (
               <>
                 <div 
                   className="text-white text-center font-bold whitespace-pre-wrap leading-relaxed drop-shadow-xl w-full animate-fade-in" 
                   style={{ 
                     textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 0 4px 10px rgba(0,0,0,0.8)', 
                     fontSize: (() => {
                       const t = itemData?.segments[segIdx] || '';
                       const charCount = t.length;
                       const visualLines = t.split('\n').reduce((acc: number, line: string) => acc + Math.ceil((line.length || 1) / 32), 0);
                       
                       if (visualLines >= 8 || charCount > 350) return '4.5cqw';
                       if (visualLines >= 6 || charCount > 250) return '5cqw';
                       if (visualLines >= 5 || charCount > 180) return '5.5cqw';
                       if (visualLines >= 4 || charCount > 120) return '6cqw';
                       if (visualLines >= 3 || charCount > 70) return '7cqw';
                       if (charCount > 40) return '8cqw';
                       return '9cqw';
                     })(),
                     lineHeight: '1.4'
                   }}
                   dangerouslySetInnerHTML={{ __html: processText(itemData?.segments[segIdx] || '') }}
                 />
                 
                 {/* Subtitle (Bait) di bawah isi */}
                 <div 
                   className="text-yellow-300 font-bold mt-[1.5cqw] tracking-widest uppercase opacity-80 animate-fade-in"
                   style={{
                     fontSize: '1.5cqw',
                     textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 10px rgba(0,0,0,0.9)',
                     minHeight: '2cqw'
                   }}
                 >
                   {(() => {
                     let label = itemData?.segmentLabels?.[segIdx] || '';
                     if (itemData?.type === 'bible' && !label) {
                         const m = itemData.title?.match(/(.+?)\s*:\s*(\d+)/);
                         label = m ? `Ayat ${parseInt(m[2], 10) + segIdx}` : `Ayat ${segIdx + 1}`;
                     }
                     if (itemData?.type === 'song' && !label) label = '•';
                     if (itemData?.type === 'song' && label.startsWith('Slide ')) label = label.replace('Slide ', 'Bait ');
                     return label;
                   })()}
                 </div>
               </>
            ) : logos.filter(l => l.enabled !== false).length > 0 ? (
               <img 
                 src={logos.filter(l => l.enabled !== false)[0].url} 
                 style={{ width: `${33 * logos.filter(l => l.enabled !== false)[0].scale}%`, maxWidth: `${400 * logos.filter(l => l.enabled !== false)[0].scale}px` }}
                 className="object-contain animate-fade-in drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" 
                 alt="Logo" 
               />
            ) : null}
          </div>
        )}

        {/* End of Safe Area */}
        </div>

        {/* Running Text Bar in Preview */}
        {isRtVisible && runningText && (
          <div 
            className={`absolute left-0 right-0 z-30 bg-black/60 backdrop-blur-sm border-y border-white/10 overflow-hidden flex items-center ${
              rtPos === 'top' ? 'top-0' : 'bottom-0'
            }`}
            style={{ height: `${((rtHeight || 7) / 56.25) * 100}%` }}
          >
            <div className="animate-marquee-seamless shrink-0" style={{ animationDuration: `${Math.max(10, 80 - ((rtSpeed || 15) * 2))}s` }}>
              {(() => {
                const spacer = "  ●  ";
                const textBlock = (runningText || '').split('\n').join(spacer);
                const rtBlockText = Array(20).fill(textBlock).join(spacer);
                return (
                  <>
                    <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${((rtHeight || 7) / 56.25 * 100) * 0.35}cqw` }}>
                      {rtBlockText}
                    </div>
                    <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${((rtHeight || 7) / 56.25 * 100) * 0.35}cqw` }}>
                      {rtBlockText}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col pb-4 px-4 gap-4 overflow-hidden relative bg-[#f1f5f9] dark:bg-slate-800">
      
      <header className="glass-panel p-3 flex justify-between items-center shrink-0 shadow-sm border-white/50 z-10 mx-4 mt-4 rounded-xl">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-white/10 dark:bg-white/90 p-1 rounded-lg shadow-md border border-white/20 w-8 h-8 flex items-center justify-center overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-heading font-extrabold text-indigo-900 dark:text-[#C5A059] tracking-tight drop-shadow-sm flex items-center">
            WorshipPresenter
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {errorMsg && <div className="text-red-700 bg-red-100/90 px-3 py-1 rounded-lg text-xs border border-red-300 font-medium whitespace-nowrap">{errorMsg}</div>}
          <SyncButton isParentSyncing={isSyncing} />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl border border-red-400 shadow-[0_2px_10px_rgba(220,38,38,0.3)] text-xs">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> LIVE
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[12%] glass-panel flex flex-col gap-3 p-3 shadow-lg border-white/50 overflow-y-auto">
          <button onClick={() => navigate('/dashboard')} className="glass-button w-full text-indigo-900 flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all hover:bg-white/70">
            DASHBOARD
          </button>
          
          <div className="w-full h-px bg-indigo-900/10 my-1"></div>
          
          <button onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('add'); }} className="glass-button w-full text-indigo-900 flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all hover:bg-white/70">
            LAGU / ALKITAB
          </button>

          <div className="mt-auto flex flex-col gap-2">
            <button 
              onClick={() => { 
                if (displayPanelTab === 'add' || !isRunningTextModalOpen) {
                  setIsRunningTextModalOpen(true); 
                  setDisplayPanelTab('rt'); 
                } else {
                  setIsRunningTextModalOpen(false);
                }
              }} 
              className={`glass-button w-full flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all ${
                (isRunningTextModalOpen && displayPanelTab !== 'add') ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md border-indigo-500' : isRtVisible ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-md border-indigo-300' : 'bg-white/50 text-indigo-900 hover:bg-white/70 border-white/40'
              }`}
            >
              LAYOUT
            </button>
          </div>
        </aside>

        {/* Center Workspace (Dual Display + Controls) */}
        <section className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
          
          {/* Dual Display Area */}
          <div className="flex gap-4 min-h-0 shrink-0 h-[45%]">
            <div className="flex-1 flex flex-col group min-h-0 bg-slate-900/40 rounded-2xl p-3 border border-white/5 shadow-inner">
              <div className="flex justify-center mb-2 shrink-0">
                <span className="bg-indigo-900/80 text-indigo-100 text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm border border-indigo-700/50">PREVIEW</span>
              </div>
              <div className="flex-1 relative flex items-center justify-center min-h-0 w-full">
                <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 shadow-xl bg-black w-full aspect-video max-h-full flex shrink-0">
                  {(() => {
                    const next = getNextSlideInfo();
                    if (next.item === -1) return <div className="flex h-full w-full items-center justify-center text-slate-500 font-bold italic text-sm">Akhir dari Rundown</div>;
                    return renderDisplayBox(next.item, next.segment, false);
                  })()}
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col group min-h-0 bg-slate-900/40 rounded-2xl p-3 border border-white/5 shadow-inner">
              <div className="flex justify-center mb-2 shrink-0">
                <span className="bg-red-900/80 text-red-100 text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm border border-red-700/50 flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div> LIVE</span>
              </div>
              <div className="flex-1 relative flex items-center justify-center min-h-0 w-full">
                <div className="relative overflow-hidden rounded-xl border border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.2)] bg-black w-full aspect-video max-h-full flex shrink-0">
                  {renderDisplayBox(liveItem, liveSegment, true)}
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar Area (Middle) */}
          <div className="flex flex-col gap-3 shrink-0 px-1">
            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Left: Prev/Next */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handlePrev} className="flex bg-[#D4B872]/10 border border-[#C5A059] text-[#C5A059] justify-center items-center gap-1.5 px-4 py-2 font-bold uppercase text-[11px] hover:bg-[#C5A059]/20 rounded-lg transition-all"><ArrowLeft size={14}/> PREV</button>
                <button onClick={handleNext} className="flex bg-[#D4B872]/10 border border-[#C5A059] text-[#C5A059] justify-center items-center gap-1.5 px-4 py-2 font-bold uppercase text-[11px] hover:bg-[#C5A059]/20 rounded-lg transition-all">NEXT <ArrowRight size={14}/></button>
              </div>

              {/* Middle: Bait Buttons (Kotak Khusus) */}
              {(() => {
                const item = tempLiveItem ? tempLiveItem : playlist[activeItem];
                const seg = tempLiveItem ? liveSegment : activeSegment;
                
                return item?.segments && item.segments.length > 1 ? (
                  <div className="flex-1 bg-transparent border border-indigo-500/30 dark:border-white/20 rounded-xl p-1.5 flex items-center gap-1.5 overflow-x-auto min-w-0 custom-scrollbar">
                    {(item.visibleSegments || [...Array(item.segments.length).keys()]).map((idx: number) => (
                      <button 
                        key={idx}
                        onClick={() => { 
                          if (tempLiveItem) {
                            pushTempToLive(tempLiveItem, idx);
                          } else {
                            setActiveSegment(idx); 
                            setMode('content'); 
                            if (activeItem === liveItem) {
                              pushStateToLive(activeItem, idx, 'content');
                            }
                          }
                        }}
                        className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition-all duration-200 border shrink-0 whitespace-nowrap ${
                          seg === idx && mode === 'content' 
                            ? 'bg-[#C5A059] text-black border-transparent shadow-[0_0_10px_rgba(197,160,89,0.3)]' 
                            : 'bg-transparent text-slate-500 dark:text-[#C5A059]/60 border-slate-300 dark:border-[#C5A059]/30 hover:bg-slate-200 dark:hover:bg-[#C5A059]/10 hover:text-slate-800 dark:hover:text-[#C5A059]'
                        }`}
                      >
                        {item?.segmentLabels ? item.segmentLabels[idx] : `Slide ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                ) : item?.type === 'video' ? (
                  <div className="flex-1 flex flex-col justify-center items-center px-4 w-full h-full min-w-0">
                    <div className="flex justify-center items-center gap-3 w-full max-w-lg">
                      <button onClick={toggleVideoPlay} className="flex bg-[#C5A059] text-black justify-center items-center gap-2 px-4 py-2 font-extrabold uppercase text-[11px] hover:bg-[#D4B872] rounded-lg transition-all shadow-[0_0_15px_rgba(197,160,89,0.3)] shrink-0">
                        {videoState === 'play' ? <><Pause size={14} className="fill-black"/> PAUSE</> : <><Play size={14} className="fill-black"/> PLAY</>}
                      </button>
                      <div className="flex-1 flex items-center gap-2 text-slate-800 dark:text-white/80 text-xs font-mono font-bold min-w-0">
                        <span className="shrink-0 w-[40px] text-right">{videoProgress ? formatVideoTime(videoProgress.currentTime) : '0:00'}</span>
                        <input 
                          type="range" 
                          min="0" 
                          max={videoProgress?.duration || 100} 
                          step="0.1"
                          value={videoProgress?.currentTime || 0}
                          onChange={handleVideoSeek}
                          className="flex-1 h-1.5 bg-slate-300 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#C5A059] shadow-inner min-w-[50px]"
                        />
                        <span className="shrink-0 w-[40px]">{videoProgress ? formatVideoTime(videoProgress.duration) : '0:00'}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-200 dark:bg-white/10 rounded-lg p-1 border border-slate-300 dark:border-white/5 shadow-inner">
                        <button 
                          onClick={toggleVideoMute} 
                          className={`p-1.5 rounded-md transition-all ${item?.muted ? 'bg-red-500/20 text-red-600 dark:text-red-300 hover:bg-red-500/30' : 'text-slate-600 dark:text-white/80 hover:bg-slate-300 dark:hover:bg-white/20 hover:text-slate-900 dark:hover:text-white'}`}
                          title={item?.muted ? 'Unmute Suara' : 'Mute Suara'}
                        >
                          {item?.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                        <div className="w-px h-4 bg-slate-400 dark:bg-white/20 mx-0.5"></div>
                        <button 
                          onClick={toggleVideoLoop} 
                          className={`p-1.5 rounded-md transition-all ${item?.loop ? 'bg-[#C5A059]/20 text-[#b38a42] dark:text-[#C5A059] hover:bg-[#C5A059]/30' : 'text-slate-600 dark:text-white/80 hover:bg-slate-300 dark:hover:bg-white/20 hover:text-slate-900 dark:hover:text-white'}`}
                          title={item?.loop ? 'Matikan Loop' : 'Nyalakan Loop'}
                        >
                          <Repeat size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1"></div>
                );
              })()}

              {/* Right: Screen & Live Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={openDisplay} className="flex bg-transparent border border-slate-600 text-slate-300 justify-center items-center gap-2 px-4 py-2 font-bold text-[11px] hover:bg-slate-800 rounded-lg transition-all">
                  <Monitor size={14}/> {isDisplayOpen ? 'Tutup Layar' : 'Buka Layar'}
                </button>
                <button 
                  onClick={() => {
                    const newMode = mode === 'blank' ? 'content' : 'blank';
                    setMode(newMode);
                    pushStateToLive(activeItem, activeSegment, newMode);
                  }} 
                  className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all uppercase ${
                    mode === 'blank' 
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  }`}
                >
                  {mode === 'blank' ? 'Tampilkan Teks' : 'BLANK DISPLAY'}
                </button>
                <button 
                  onClick={() => {
                    const targetMode = mode === 'blank' ? 'content' : mode;
                    if (mode === 'blank') setMode('content');
                    pushStateToLive(activeItem, activeSegment, targetMode);
                  }} 
                  className="bg-[#C5A059] hover:bg-[#D4B872] text-black px-6 py-2 rounded-lg text-[11px] font-extrabold shadow-[0_0_15px_rgba(197,160,89,0.3)] transition-all flex items-center gap-2"
                >
                  <Play size={12} className="fill-black"/> TAMPILKAN LIVE
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Settings Panel */}
          <div className="glass-panel shrink-0 flex flex-col p-3 flex-1 min-h-[220px]">
            {/* Tab Headers */}
            {displayPanelTab !== 'add' && (
              <div className="flex gap-2 mb-3">
                <button 
                  onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('rt'); }} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    displayPanelTab === 'rt' 
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm' 
                      : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                  }`}
                >Running Text</button>
                <button 
                  onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('bg'); }} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    displayPanelTab === 'bg' 
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm' 
                      : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                  }`}
                >Background</button>
                <button 
                  onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('logo'); }} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    displayPanelTab === 'logo' 
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm' 
                      : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                  }`}
                >Logo / Watermark</button>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-black/40 rounded-xl p-4 border border-indigo-100 dark:border-white/5">
              {!isRunningTextModalOpen ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-indigo-900/50 dark:text-slate-500">
                  <Layout size={32} className="opacity-20" />
                  <span className="text-xs italic font-semibold">Pilih menu di samping kiri untuk membuka panel kontrol</span>
                </div>
              ) : (
                <>
                  {displayPanelTab === 'add' && (
                    <div className="flex flex-col h-full gap-3">
                      <div className="flex gap-2 shrink-0">
                        <div className="flex gap-2 flex-1">
                          <button onClick={() => { setSearchType('song'); setSearchQuery(''); }} className={`flex-1 flex justify-center items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-xs font-semibold ${searchType === 'song' ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-md' : 'bg-white dark:bg-slate-800 text-indigo-900 dark:text-slate-300 border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}><Music size={14}/> Lagu</button>
                          <button onClick={() => { setSearchType('bible'); setSearchQuery(''); }} className={`flex-1 flex justify-center items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-xs font-semibold ${searchType === 'bible' ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-md' : 'bg-white dark:bg-slate-800 text-indigo-900 dark:text-slate-300 border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}><BookOpen size={14}/> Alkitab</button>
                        </div>
                        <div className="flex-1">
                          <select 
                            className="w-full bg-white/50 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-indigo-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500 transition"
                            value={searchType === 'song' ? selectedSongVersion : selectedBibleVersion}
                            onChange={(e) => searchType === 'song' ? setSelectedSongVersion(e.target.value) : setSelectedBibleVersion(e.target.value)}
                          >
                            {dbList.filter(d => d.type === searchType).map(db => (
                              <option key={db.id} value={db.id} className="dark:bg-[#0A1128] dark:text-[#C5A059]">{db.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                        <form onSubmit={handleSearch} className="flex gap-2 shrink-0">
                          <div className="relative flex-1">
                              <input 
                                type="text" 
                                id="searchInputBox"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Cari ${searchType === 'song' ? 'Lagu' : 'Alkitab'}...`} 
                                className="glass-input w-full pr-8 !bg-white dark:!bg-slate-900 dark:text-white dark:border-slate-700"
                                autoFocus
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
                            <button type="submit" disabled={isSearching} className="glass-button bg-indigo-500/20 dark:bg-slate-800 text-indigo-900 dark:text-[#C5A059] border-indigo-500/30 dark:border-slate-700 px-4 py-1.5 rounded-lg transition">
                              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14}/>}
                            </button>
                          </form>

                          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 border border-indigo-100 dark:border-slate-700 rounded-xl p-2 bg-white/50 dark:bg-slate-900/50 scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-slate-700">
                            {searchResults.map((res) => (
                              <div key={res.id} className="p-2 mb-2 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-lg transition flex justify-between gap-2 items-center">
                                <div className="flex-1 overflow-hidden">
                                  <div className="font-semibold text-indigo-900 dark:text-[#C5A059] text-[11px] truncate">{res.title}</div>
                                  {(res.author || res.key || res.beat || res.category) && (
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[9px] text-indigo-600/80 dark:text-slate-400">
                                      {res.author && <span className="truncate max-w-[100px]" title={res.author}>👤 {res.author}</span>}
                                      {res.key && <span title="Nada Dasar">🎵 {res.key}</span>}
                                      {res.beat && <span title="Ketukan">⏱ {res.beat}</span>}
                                      {res.category && <span title="Kategori">🏷️ {res.category}</span>}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-indigo-800/60 dark:text-slate-500 line-clamp-2 mt-1">{res.segments && res.segments[0]}</div>
                                </div>
                                <div className="flex flex-col gap-1.5 shrink-0 w-[85px]">
                                  <button 
                                    onClick={() => addToRundown(res)}
                                    className="bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-500/30 dark:border-green-700 px-2 py-1.5 rounded transition font-bold uppercase tracking-wider text-[9px] flex justify-center items-center gap-1 w-full"
                                  >
                                    <Plus size={10}/> Rundown
                                  </button>
                                  <button 
                                    onClick={() => pushTempToLive(res)}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-500/30 dark:border-red-700 px-2 py-1.5 rounded transition font-bold uppercase tracking-wider text-[9px] flex justify-center items-center gap-1 w-full"
                                  >
                                    <Play size={10} className="fill-current"/> Live
                                  </button>
                                </div>
                              </div>
                            ))}
                            {searchResults.length === 0 && !isSearching && searchQuery !== '' && (
                              <div className="text-center text-[10px] text-indigo-900/60 dark:text-slate-500 p-4">Tidak ada hasil ditemukan.</div>
                            )}
                            {searchResults.length === 0 && !isSearching && searchQuery === '' && (
                              <div className="p-1">
                                {searchType === 'song' ? (
                                  <>
                                      <div className="flex flex-col gap-1">
                                        {allSongTitles ? allSongTitles.map((song: any) => (
                                          <div key={song.id} className="p-2 mb-1 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-lg transition flex justify-between gap-2 items-center">
                                            <div className="flex-1 overflow-hidden flex items-start gap-2">
                                              <span className="bg-indigo-100 dark:bg-black/30 text-indigo-800 dark:text-[#C5A059] px-2 py-0.5 rounded text-[10px] min-w-[32px] text-center shrink-0 border border-white/20 dark:border-slate-700 mt-0.5">{song.id}</span>
                                              <div className="flex-1 min-w-0 flex flex-col">
                                                <div className="font-semibold text-indigo-900 dark:text-[#C5A059] text-[11px] truncate">{song.title}</div>
                                                {(song.author || song.key || song.beat || song.category) && (
                                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-indigo-600/80 dark:text-slate-400 mt-0.5">
                                                    {song.author && <span className="truncate max-w-[100px]" title={song.author}>👤 {song.author}</span>}
                                                    {song.key && <span title="Nada Dasar">🎵 {song.key}</span>}
                                                    {song.beat && <span title="Ketukan">⏱ {song.beat}</span>}
                                                    {song.category && <span title="Kategori">🏷️ {song.category}</span>}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5 shrink-0 w-[85px]">
                                              <button 
                                                onClick={() => handleQuickAddSong(song.id.toString(), false)}
                                                className="bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-500/30 dark:border-green-700 px-2 py-1.5 rounded transition font-bold uppercase tracking-wider text-[9px] flex justify-center items-center gap-1 w-full"
                                              >
                                                <Plus size={10}/> Rundown
                                              </button>
                                              <button 
                                                onClick={() => handleQuickAddSong(song.id.toString(), true)}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-500/30 dark:border-red-700 px-2 py-1.5 rounded transition font-bold uppercase tracking-wider text-[9px] flex justify-center items-center gap-1 w-full"
                                              >
                                                <Play size={10} className="fill-current"/> Live
                                              </button>
                                            </div>
                                          </div>
                                        )) : (
                                          <div className="text-center p-4"><Loader2 size={16} className="animate-spin text-indigo-500 mx-auto"/></div>
                                        )}
                                      </div>
                                  </>
                                ) : (
                                  <div className="grid grid-cols-3 gap-1">
                                    {currentBibleBooks.length > 0 ? currentBibleBooks.map(book => (
                                      <button 
                                        key={book}
                                        onClick={() => {
                                          setSearchQuery(book + " ");
                                          document.getElementById('searchInputBox')?.focus();
                                        }}
                                        className="p-1.5 text-center text-[10px] font-semibold text-indigo-900 dark:text-slate-300 bg-white/40 dark:bg-slate-800 border border-white/20 dark:border-slate-700 rounded hover:bg-indigo-600 dark:hover:bg-[#C5A059] hover:text-white dark:hover:text-black transition line-clamp-1 shadow-sm"
                                      >
                                        {book}
                                      </button>
                                    )) : (
                                      <div className="col-span-3 text-center p-4"><Loader2 size={16} className="animate-spin text-indigo-500 mx-auto"/></div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                      </div>
                    </div>
                  )}

                  {displayPanelTab === 'rt' && (
                    <div className="flex flex-col gap-4 h-full">
                      <div className="flex items-center gap-3 shrink-0">
                        <button 
                          onClick={() => setIsRtVisible(!isRtVisible)}
                          className={`flex-1 py-3 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all ${
                            isRtVisible ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 text-white shadow-indigo-600/20'
                          }`}
                        >
                          <Power size={14} /> 
                          {isRtVisible ? 'MATIKAN' : 'HIDUPKAN'}
                        </button>
                      </div>

                      <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <textarea 
                          value={runningText}
                          onChange={e => setRunningText(e.target.value)}
                          placeholder="Ketik teks yang ingin ditampilkan berjalan dari kanan ke kiri..."
                          className="glass-input flex-1 min-h-0 resize-none font-semibold text-sm !p-3 dark:!bg-slate-900"
                        ></textarea>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-lg p-2">
                        <div className="flex-1 flex gap-3 items-center">
                          <span className="text-[10px] font-bold text-indigo-900/50 dark:text-slate-400 uppercase w-12">Ukuran</span>
                          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Kecil</span>
                          <input type="range" min="3" max="25" value={rtHeight} onChange={e => setRtHeight(Number(e.target.value))} className="flex-1 accent-indigo-600 dark:accent-[#C5A059]" />
                          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Besar</span>
                        </div>
                        <div className="w-px h-6 bg-indigo-100 dark:bg-slate-700"></div>
                        <div className="flex-1 flex gap-3 items-center">
                          <span className="text-[10px] font-bold text-indigo-900/50 dark:text-slate-400 uppercase w-12">Speed</span>
                          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Cepat</span>
                          <input type="range" min="5" max="40" value={rtSpeed} onChange={e => setRtSpeed(Number(e.target.value))} className="flex-1 accent-indigo-600 dark:accent-[#C5A059]" />
                          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Lambat</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {displayPanelTab === 'logo' && (
                    <div className="flex flex-col gap-3 h-full overflow-hidden">
                      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
                        {logos.map((logo, index) => (
                          <div key={logo.id} className="flex gap-3 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-lg p-3 shadow-sm items-center">
                            <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-900/50 dark:bg-black/50 shrink-0 flex items-center justify-center border border-slate-700/50 p-1 shadow-inner backdrop-blur-sm">
                              <img src={logo.url} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-sm" />
                            </div>
                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-900/60 dark:text-slate-400 shrink-0 w-12">Logo {index + 1}</span>
                                <span className="text-[9px] font-bold text-indigo-900/50 dark:text-slate-500">Kecil</span>
                                <input type="range" min="0.1" max="5" step="0.1" value={logo.scale} onChange={(e) => updateLogo(logo.id, { scale: parseFloat(e.target.value) })} className="flex-1 accent-indigo-600 dark:accent-[#C5A059]" />
                                <span className="text-[9px] font-bold text-indigo-900/50 dark:text-slate-500">Besar</span>
                                <span className="text-[9px] font-bold text-indigo-600 dark:text-[#C5A059] w-8 text-right mr-1">{Math.round(logo.scale * 100)}%</span>
                                <button 
                                  onClick={() => updateLogo(logo.id, { enabled: logo.enabled === false ? true : false })} 
                                  className={`p-1 px-2 text-[9px] font-bold rounded transition shrink-0 mr-1 ${logo.enabled !== false ? 'bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/40' : 'bg-slate-500/20 text-slate-700 dark:text-slate-400 hover:bg-slate-500/40'}`}
                                >
                                  {logo.enabled !== false ? 'ON' : 'OFF'}
                                </button>
                                <button onClick={() => removeLogo(logo.id)} className="text-red-400 hover:text-white hover:bg-red-500 p-1 rounded transition shrink-0"><X size={12}/></button>
                              </div>
                              <div className="flex gap-2 h-7">
                                <button onClick={() => updateLogo(logo.id, { x: 2, y: 3 })} className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x < 50 && logo.y < 50 ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent' : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}>Kiri Atas</button>
                                <button onClick={() => updateLogo(logo.id, { x: 98, y: 3 })} className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x >= 50 && logo.y < 50 ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent' : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}>Kanan Atas</button>
                                <button onClick={() => updateLogo(logo.id, { x: 2, y: 97 })} className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x < 50 && logo.y >= 50 ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent' : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}>Kiri Bawah</button>
                                <button onClick={() => updateLogo(logo.id, { x: 98, y: 97 })} className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x >= 50 && logo.y >= 50 ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent' : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}>Kanan Bawah</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {logos.length === 0 && <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-semibold italic min-h-[100px]">Belum ada logo — klik Tambah Logo di bawah</div>}
                      </div>
                      <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" />
                      <button onClick={() => logoInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-indigo-300 dark:border-slate-600 rounded-xl text-xs text-indigo-900/60 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-[#C5A059] hover:border-indigo-400 dark:hover:border-[#C5A059] hover:bg-indigo-50/50 dark:hover:bg-white/5 font-bold transition flex items-center justify-center gap-2 shrink-0"><Plus size={16}/> Tambah Logo</button>
                    </div>
                  )}

                  {displayPanelTab === 'bg' && (
                    <div className="h-full">
                      <BackgroundPickerInline 
                        onSelect={handleGlobalBackgroundSelect} 
                        currentBgUrl={localStorage.getItem('custom_bg')} 
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right Sidebar (Rundown / Setlist) */}
        <aside className="w-[25%] glass-panel p-4 flex flex-col overflow-hidden shadow-lg border-white/50">
          <div className="mb-4 flex w-full">
            <FooterClock />
          </div>
          <div className="flex justify-between items-start mb-4 shrink-0 gap-2 border-b border-indigo-900/10 pb-3">
            <div className="flex-1">
              {isEditingRundown ? (
                <div className="flex flex-col gap-2 w-full">
                  <input 
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="bg-white dark:bg-slate-800 text-indigo-950 dark:text-indigo-100 font-bold px-3 py-2 rounded-lg border-2 border-indigo-200 dark:border-indigo-700 focus:outline-none focus:border-indigo-500 w-full text-sm"
                    placeholder="Nama Playlist"
                  />
                  <input 
                    type="date"
                    value={playlistDate}
                    onChange={(e) => setPlaylistDate(e.target.value)}
                    className="bg-white/50 dark:bg-slate-800/50 text-indigo-900 dark:text-indigo-200 px-3 py-2 rounded-lg border-2 border-indigo-200 dark:border-indigo-700 focus:outline-none focus:border-indigo-500 w-full text-xs font-semibold"
                  />
                </div>
              ) : (
                <>
                  <h2 className="font-heading font-extrabold text-indigo-950 dark:text-indigo-100 uppercase tracking-wide text-base leading-tight">{playlistName}</h2>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">{playlistDate}</div>
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
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-all shadow-sm font-bold shrink-0 ${
                isEditingRundown 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30' 
                  : 'glass-button bg-white text-indigo-900 hover:bg-white/80 border-white'
              }`}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : (isEditingRundown ? <Save size={14} /> : <Edit size={14} />)}
              {isEditingRundown ? 'Simpan' : 'Edit'}
            </button>
          </div>
          <div className="text-xs font-bold text-indigo-900/50 dark:text-indigo-200/50 mb-2 uppercase tracking-wider">RUNDOWN</div>
          
          <div className="space-y-2 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent flex-1">
            {playlist.length === 0 && (
              <div className="text-center text-sm font-semibold text-indigo-900/40 dark:text-indigo-200/40 mt-10">Rundown kosong.</div>
            )}
            {playlist.map((item, idx) => (
              <div 
                id={`rundown-item-${idx}`}
                key={item.id || idx} 
                className={`flex gap-2 transition-all duration-300 ${dragItem === idx ? 'opacity-40 scale-95' : 'hover:-translate-y-1'}`}
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
                    const item = playlist[idx];
                    const visible = item.visibleSegments || [...Array(item.segments?.length || 1).keys()];
                    const seg = visible.length > 0 ? visible[0] : 0;
                    
                    setActiveItem(idx);
                    setActiveSegment(seg);
                    setTempLiveItem(null);
                    const newMode = item.type === 'video' ? 'logo' : 'content';
                    setMode(newMode);
                  }}
                  className={`flex-1 text-left p-3 rounded-xl border-2 backdrop-blur-sm transition-all ${isEditingRundown ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                    activeItem === idx
                      ? 'bg-white dark:bg-[#C5A059]/10 border-indigo-400 dark:border-[#C5A059] shadow-md shadow-indigo-500/10 dark:shadow-[0_0_15px_rgba(197,160,89,0.3)] relative z-10' 
                      : 'bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/60 dark:hover:bg-white/10 hover:border-white dark:hover:border-white/20 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between w-full items-start gap-2">
                    <div className={`font-bold text-sm leading-tight line-clamp-2 ${activeItem === idx ? 'text-indigo-900 dark:text-[#D4B872]' : 'text-indigo-900/80 dark:text-indigo-200/70'}`}>
                      {idx + 1}. {item.title || item.name || '(Tanpa Judul)'}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {(item.type === 'song' || item.type === 'bible' || item.type === 'video') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.type === 'video') openVideoModal(idx);
                            else openSegmentModal(idx, e);
                          }}
                          className="text-indigo-500 dark:text-indigo-300 hover:text-white dark:hover:text-white hover:bg-indigo-500 dark:hover:bg-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 p-1.5 rounded-lg transition-colors shrink-0"
                          title={item.type === 'video' ? "Edit Link Video" : "Atur Slide / Bait"}
                        >
                          <Settings size={14} />
                        </button>
                      )}
                      
                      {item.type !== 'video' && item.type !== 'image' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditItemIndex(idx);
                            setEditSegmentIndex(0);
                          }}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-white dark:hover:text-white hover:bg-emerald-500 dark:hover:bg-emerald-500 bg-emerald-50 dark:bg-emerald-900/40 p-1.5 rounded-lg transition-colors shrink-0"
                          title="Edit Teks / Konten"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded uppercase tracking-widest">{item.type}</div>
                    
                    {item.type === 'countdown' && <div className="text-[10px] font-bold text-indigo-900/50 dark:text-indigo-200/50 uppercase">{Math.floor(parseInt(item.segments[0] || '0') / 60)}:{(parseInt(item.segments[0] || '0') % 60).toString().padStart(2, '0')}</div>}
                    
                    {isEditingRundown && (
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (replaceIndex === idx) setReplaceIndex(null); 
                            else { setReplaceIndex(idx); setIsAddItemModalOpen(true); } 
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${replaceIndex === idx ? 'bg-indigo-600 text-white' : 'text-indigo-500 hover:bg-indigo-50'}`}
                          title="Ganti Item"
                        >
                          <RefreshCw size={12} />
                        </button>
                        <button 
                          onClick={(e) => removePlaylistItem(idx, e)}
                          className="text-red-500 hover:text-white hover:bg-red-500 p-1.5 rounded-lg transition-colors bg-red-50"
                          title="Hapus"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-900/10 shrink-0">
            {replaceIndex !== null && (
              <div className="mb-2 bg-indigo-100 text-indigo-900 text-xs p-2 rounded-lg border border-indigo-200 flex justify-between items-center">
                <span className="truncate pr-2">Ganti: <strong>{playlist[replaceIndex]?.title}</strong></span>
                <button onClick={() => setReplaceIndex(null)} className="text-red-500 hover:bg-red-500/10 p-1 rounded shrink-0"><X size={12}/></button>
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <button 
                onClick={addQuickAnnouncement}
                className="flex-1 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-1.5 text-indigo-900 py-2 text-[11px] font-semibold hover:bg-white/70 transition-all"
                title="Tambah Teks / Pengumuman"
              >
                <Plus size={14} /> TEKS
              </button>
              <button 
                onClick={() => openVideoModal(replaceIndex)}
                className="flex-none w-14 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center text-indigo-900 py-2 hover:bg-white/70 transition-all"
                title="Tambah Video"
              >
                <Video size={24} />
              </button>
              <button 
                onClick={() => { setReplaceIndex(replaceIndex); document.getElementById('rundown-img-upload')?.click(); }}
                className="flex-none w-14 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center text-indigo-900 py-2 hover:bg-white/70 transition-all"
                title="Tambah Gambar (Maks 2)"
              >
                <ImageIcon size={24} />
              </button>
              <button 
                onClick={addCountdown}
                className="flex-1 glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-1.5 text-indigo-900 py-2 text-[11px] font-semibold hover:bg-white/70 transition-all"
                title="Tambah Waktu / Hitung Mundur"
              >
                <Clock size={14} /> WAKTU
              </button>
            </div>
            <input 
              type="file" 
              id="rundown-img-upload" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={handleRundownImageUpload} 
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlist, null, 2));
                  const downloadAnchorNode = document.createElement('a');
                  downloadAnchorNode.setAttribute("href", dataStr);
                  const sanitizedName = (playlistName || "rundown").replace(/[^a-z0-9]/gi, '_').toLowerCase();
                  downloadAnchorNode.setAttribute("download", `${sanitizedName}.json`);
                  document.body.appendChild(downloadAnchorNode);
                  downloadAnchorNode.click();
                  downloadAnchorNode.remove();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition flex justify-center items-center gap-1.5 uppercase tracking-wider"
              >
                <Save size={14} /> Simpan
              </button>
              
              <label className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 flex-1 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex justify-center items-center gap-1.5 uppercase tracking-wider cursor-pointer">
                <FileText size={14} /> Input
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const importedPlaylist = JSON.parse(event.target?.result as string);
                        if (Array.isArray(importedPlaylist)) {
                          setPlaylist(importedPlaylist);
                          localStorage.setItem(`worship_playlist_${playlistId}`, JSON.stringify(importedPlaylist));
                          if (isEditingRundown) saveRundown();
                        } else {
                          alert("Format file tidak valid. Harus berupa array rundown.");
                        }
                      } catch (err) {
                        alert("Gagal membaca file JSON.");
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </aside>
      </main>
      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl max-w-xl w-full border border-white/50 relative">
            <button onClick={() => setIsVideoModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-all">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-indigo-900 mb-4">Tambahkan Video</h2>
            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Upload File Video (MP4, dsb. Maks 30MB)</label>
                <input 
                  type="file" 
                  accept="video/*" 
                  id="cp-video-file-upload"
                  className="hidden"
                  onChange={handleVideoUpload}
                />
                <label 
                  htmlFor="cp-video-file-upload"
                  className={`glass-button text-sm py-4 cursor-pointer flex justify-center items-center gap-2 w-full border-2 border-dashed transition-all ${isVideoUploading ? 'bg-indigo-50 border-indigo-200 text-indigo-500' : videoUrlInput.startsWith('local_vid_') ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100 hover:border-slate-400'}`}
                >
                  {isVideoUploading ? <Loader2 size={20} className="animate-spin" /> : (videoUrlInput.startsWith('local_vid_') ? <><CheckCircle size={20} /> File Dipilih! Klik untuk mengganti</> : <><Plus size={20} /> Pilih File Video</>)}
                </label>
                
                <label className="flex items-center gap-3 mt-4 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isVideoLoop} 
                    onChange={(e) => setIsVideoLoop(e.target.checked)} 
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shadow-sm" 
                  />
                  <span className="text-slate-700 font-semibold select-none">Putar berulang-ulang (Loop) sampai pindah slide</span>
                </label>
                <label className="flex items-center gap-3 mt-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isVideoMuted} 
                    onChange={(e) => setIsVideoMuted(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                  />
                  <span className="text-slate-700 font-semibold select-none">Bisukan Suara (Mute)</span>
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

      {/* EDIT ITEM MODAL */}
      {editItemIndex !== null && playlist[editItemIndex] && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full border border-white/50 relative flex flex-col max-h-[90vh]">
            <button onClick={() => setEditItemIndex(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-all">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Edit size={24} /> Edit {playlist[editItemIndex].type === 'announcement' ? 'Pengumuman' : playlist[editItemIndex].type === 'countdown' ? 'Hitung Mundur' : 'Lagu / Teks'}
            </h2>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* Title Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Judul (Opsional)</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-indigo-900 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  value={playlist[editItemIndex].title || ''}
                  onChange={(e) => {
                    setPlaylist(prev => {
                      const pl = [...prev];
                      pl[editItemIndex] = { ...pl[editItemIndex], title: e.target.value };
                      return pl;
                    });
                  }}
                  placeholder="Masukkan Judul..."
                />
              </div>

              {/* Countdown Inputs */}
              {playlist[editItemIndex].type === 'countdown' ? (
                <div className="flex gap-4 items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex flex-col items-center">
                    <input 
                      type="number"
                      className="w-24 text-center bg-white border-2 border-indigo-200 rounded-xl p-3 text-3xl focus:outline-none focus:border-indigo-500 transition-all font-bold"
                      value={Math.floor(parseInt(playlist[editItemIndex].segments[0] || '0') / 60)}
                      onChange={(e) => {
                        setPlaylist(prev => {
                          const pl = [...prev];
                          const sec = parseInt(pl[editItemIndex].segments[0] || '0') % 60;
                          pl[editItemIndex] = { ...pl[editItemIndex], segments: [String(Number(e.target.value) * 60 + sec)] };
                          return pl;
                        });
                      }}
                    />
                    <span className="text-slate-500 mt-2 text-xs font-bold uppercase tracking-wider">Menit</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-300 pb-6">:</div>
                  <div className="flex flex-col items-center">
                    <input 
                      type="number"
                      className="w-24 text-center bg-white border-2 border-indigo-200 rounded-xl p-3 text-3xl focus:outline-none focus:border-indigo-500 transition-all font-bold"
                      value={parseInt(playlist[editItemIndex].segments[0] || '0') % 60}
                      onChange={(e) => {
                        setPlaylist(prev => {
                          const pl = [...prev];
                          const min = Math.floor(parseInt(pl[editItemIndex].segments[0] || '0') / 60);
                          pl[editItemIndex] = { ...pl[editItemIndex], segments: [String(min * 60 + Number(e.target.value))] };
                          return pl;
                        });
                      }}
                    />
                    <span className="text-slate-500 mt-2 text-xs font-bold uppercase tracking-wider">Detik</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Segment Tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {(playlist[editItemIndex].segments as any[]).map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setEditSegmentIndex(i)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                          editSegmentIndex === i ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {playlist[editItemIndex].segmentLabels?.[i] || (playlist[editItemIndex].type === 'announcement' ? `Slide ${i + 1}` : `Bait ${i + 1}`)}
                      </button>
                    ))}
                    {(playlist[editItemIndex].type === 'song' || playlist[editItemIndex].type === 'announcement') && (
                      <button
                        onClick={() => {
                          setPlaylist(prev => {
                            const pl = [...prev];
                            const currentLabels = pl[editItemIndex].segmentLabels || pl[editItemIndex].segments.map((_: any, i: number) => pl[editItemIndex].type === 'announcement' ? `Slide ${i + 1}` : `Bait ${i + 1}`);
                            const newLabel = pl[editItemIndex].type === 'announcement' ? `Slide ${pl[editItemIndex].segments.length + 1}` : `Bait ${pl[editItemIndex].segments.length + 1}`;
                            pl[editItemIndex] = { 
                              ...pl[editItemIndex], 
                              segments: [...pl[editItemIndex].segments, ''],
                              segmentLabels: [...currentLabels, newLabel]
                            };
                            return pl;
                          });
                          setEditSegmentIndex(playlist[editItemIndex].segments.length);
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-all flex items-center gap-1"
                      >
                        <Plus size={14} /> {playlist[editItemIndex].type === 'announcement' ? 'Tambah Slide' : 'Tambah Bait'}
                      </button>
                    )}
                  </div>
                  
                  {/* Rich Editor */}
                  <div className="flex flex-col gap-2">
                    <RichEditor
                      ref={editorRef}
                      className="w-full min-h-[150px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-indigo-900 whitespace-pre-wrap leading-relaxed transition-all resize-y"
                      value={playlist[editItemIndex].segments[editSegmentIndex] || ''}
                      onChange={(val) => {
                        setPlaylist(prev => {
                          const pl = [...prev];
                          pl[editItemIndex] = { ...pl[editItemIndex], segments: [...pl[editItemIndex].segments] };
                          pl[editItemIndex].segments[editSegmentIndex] = val;
                          return pl;
                        });
                      }}
                      onSelectChange={setHasSelection}
                      placeholder="Ketik teks di sini (blok teks untuk mewarnai)..."
                    />

                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
              <button 
                onClick={() => {
                  setPlaylist(prev => {
                    const pl = [...prev];
                    pl.splice(editItemIndex, 1);
                    return pl;
                  });
                  setEditItemIndex(null);
                }}
                className="px-4 py-2 rounded-xl text-red-600 font-bold hover:bg-red-50 flex items-center gap-2 transition"
              >
                <Trash2 size={16} /> Hapus Item
              </button>
              <button onClick={() => setEditItemIndex(null)} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition">
                Selesai
              </button>
            </div>
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
