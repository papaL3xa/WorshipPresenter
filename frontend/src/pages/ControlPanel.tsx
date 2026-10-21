import { useState, useEffect, useRef } from 'react';
import { Monitor, Square, Play, Pause, ArrowRight, ArrowLeft, Loader2, Image as ImageIcon, Video, CheckCircle, Type, Plus, Trash2, Edit, Save, Search, Music, BookOpen, Settings, CheckSquare, X, RefreshCw, Clock, Layout, Power, FileText, Repeat, Volume2, VolumeX, List, GripVertical, Palette, AlignCenter, AlignLeft, AlignRight, Bold, Keyboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { callApi } from '../api';
import { CONFIG } from '../config';
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
import { initDefaultDatabases, searchLocalSongs, searchLocalBible, syncCustomSongs, getDatabaseList, DatabaseVersion, getAllLocalSongTitles, getBibleBooksList, getCrossLanguageVerses } from '../utils/dbStorage';
import { calculateOptimalFontSize } from '../utils/fontCalculator';
import { QuickSearchPanel } from '../components/control-panel/panels/QuickSearchPanel';
import { ThemeSettingsPanel } from '../components/control-panel/panels/ThemeSettingsPanel';
import { LogoManagerPanel } from '../components/control-panel/panels/LogoManagerPanel';
import { RunningTextPanel } from '../components/control-panel/panels/RunningTextPanel';
import { expandSongWithChorus, hasChorus, isChorusAlreadyEmbedded } from '../utils/songHelper';
import { EditItemModal } from '../components/control-panel/modals/EditItemModal';
import { SegmentModal } from '../components/control-panel/modals/SegmentModal';
import { CountdownModal } from '../components/control-panel/modals/CountdownModal';
import { VideoModal } from '../components/control-panel/modals/VideoModal';
import { HotkeyHelpModal } from '../components/control-panel/modals/HotkeyHelpModal';

const processText = (raw: string) => {
  if (!raw) return '';
  let t = raw;
  t = t.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]([^\[\n]*)/g, ''); // ControlPanel strips chords

  // Bilingual side-by-side layout
  if (t.includes('\n[kuning]')) {
    const parts = t.split('\n[kuning]');
    if (parts.length === 2 && parts[1].endsWith('[/kuning]')) {
      const left = parts[0].replace(/\n/g, '<br/>');
      const right = parts[1].replace('[/kuning]', '').replace(/\n/g, '<br/>');
      return `<div class="grid grid-cols-2 gap-12 w-full relative"><div class="min-w-0 break-words text-left self-center">${left}</div><div class="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white/30 rounded-full my-2 pointer-events-none"></div><div class="min-w-0 break-words text-right text-yellow-300 self-center">${right}</div></div>`;
    }
  }

  // 2-Kolom Bebas (Pengumuman)
  if (t.includes('\n[kolom2]')) {
    const parts = t.split('\n[kolom2]');
    if (parts.length === 2 && parts[1].endsWith('[/kolom2]')) {
      const left = parts[0].replace(/\n/g, '<br/>');
      const right = parts[1].replace('[/kolom2]', '').replace(/\n/g, '<br/>');
      return `<div class="grid grid-cols-2 gap-12 w-full relative"><div class="min-w-0 break-words text-left self-center">${left}</div><div class="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white/30 rounded-full my-2 pointer-events-none"></div><div class="min-w-0 break-words text-left self-center">${right}</div></div>`;
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

const renderSnippet = (text: string) => {
  if (!text) return '';
  let t = text.replace(/\n/g, ' - ');
  t = t.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]/g, ''); // strip chords
  t = t.replace(/\[kuning\](.*?)\[\/kuning\]/gi, '<span class="text-yellow-600 dark:text-yellow-500 font-medium">$1</span>');
  t = t.replace(/\[merah\](.*?)\[\/merah\]/gi, '<span class="text-red-600 dark:text-red-500 font-medium">$1</span>');
  t = t.replace(/\[hijau\](.*?)\[\/hijau\]/gi, '<span class="text-green-600 dark:text-green-500 font-medium">$1</span>');
  t = t.replace(/\[biru\](.*?)\[\/biru\]/gi, '<span class="text-blue-600 dark:text-blue-500 font-medium">$1</span>');
  return t;
};

const getVisibleSegments = (item: any): number[] => {
  if (!item) return [];
  if (Array.isArray(item.visibleSegments)) return item.visibleSegments;
  const count = item.segments?.length || 1;
  return Array.from({ length: count }, (_, i) => i);
};


const AutoResizeTextarea = ({ value, onChange, className, rows = 2, style }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value, style]);
  return <textarea ref={ref} value={value} onChange={onChange} className={className} rows={rows} style={style} />;
};

const SegmentEditor = ({ value, onChange, className, style }: any) => {
  const isBilingual = value && typeof value === 'string' && value.includes('\n[kuning]') && value.endsWith('[/kuning]');
  const is2Kolom = value && typeof value === 'string' && value.includes('\n[kolom2]') && value.endsWith('[/kolom2]');
  const [force2Kolom, setForce2Kolom] = useState(false);

  if (isBilingual) {
    const parts = value.split('\n[kuning]');
    const left = parts[0];
    const right = parts[1].replace('[/kuning]', '');
    return (
      <div className="flex flex-col gap-2 w-full">
        <AutoResizeTextarea
          value={left}
          onChange={(e: any) => onChange(e.target.value + '\n[kuning]' + right + '[/kuning]')}
          className={className}
          style={style}
          rows={2}
        />
        <div className="flex items-center gap-2">
          <div className="h-px bg-indigo-100 dark:bg-slate-700/50 flex-1"></div>
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Terjemahan</span>
          <div className="h-px bg-indigo-100 dark:bg-slate-700/50 flex-1"></div>
        </div>
        <AutoResizeTextarea
          value={right}
          onChange={(e: any) => onChange(left + '\n[kuning]' + e.target.value + '[/kuning]')}
          className={className.replace('text-slate-900', 'text-yellow-700').replace('dark:text-slate-100', 'dark:text-yellow-300').replace('text-slate-800', 'text-yellow-700').replace('dark:text-slate-200', 'dark:text-yellow-300')}
          style={style}
          rows={2}
        />
      </div>
    );
  }

  if (is2Kolom || force2Kolom) {
    const parts = is2Kolom ? value.split('\n[kolom2]') : [value, ''];
    const left = parts[0] || '';
    const right = parts[1] ? parts[1].replace('[/kolom2]', '') : '';

    return (
      <div className="flex gap-2 w-full">
        <div className="flex-1 flex flex-col gap-1">
          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Kolom Kiri</div>
          <AutoResizeTextarea
            value={left}
            onChange={(e: any) => {
              const newLeft = e.target.value;
              if (!newLeft && !right) { setForce2Kolom(false); onChange(''); }
              else if (!right) onChange(newLeft);
              else onChange(newLeft + '\n[kolom2]' + right + '[/kolom2]');
            }}
            className={className}
            style={style}
            rows={2}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Kolom Kanan</div>
            <button onClick={() => { setForce2Kolom(false); onChange(left); }} className="text-[9px] text-red-500 hover:text-red-600 font-bold px-1.5 py-0.5 rounded hover:bg-red-500/10" title="Hapus Kolom Kanan">✕ Tutup</button>
          </div>
          <AutoResizeTextarea
            value={right}
            onChange={(e: any) => {
              const newRight = e.target.value;
              if (!newRight && !left) { setForce2Kolom(false); onChange(''); }
              else if (!newRight) onChange(left);
              else onChange(left + '\n[kolom2]' + newRight + '[/kolom2]');
            }}
            className={className}
            style={style}
            rows={2}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full relative group">
      <AutoResizeTextarea
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        className={className}
        style={style}
        rows={2}
      />
      <button
        onClick={() => { setForce2Kolom(true); onChange(value + '\n[kolom2][/kolom2]'); }}
        className="absolute bottom-2 right-2 text-[10px] bg-white/90 dark:bg-slate-800/90 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-slate-600 font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-indigo-200 dark:border-slate-700"
      >
        + Kolom Kanan
      </button>
    </div>
  );
};

function parseVersion(versionStr: string): number[] {
  const match = versionStr.match(/(\d+\.\d+\.\d+)/);
  if (!match) return [0, 0, 0];
  return match[1].split('.').map(Number);
}

function isNewerVersion(remote: string, current: string): boolean {
  const r = parseVersion(remote);
  const c = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (r[i] > c[i]) return true;
    if (r[i] < c[i]) return false;
  }
  return false;
}

import { useLocation, useNavigate } from 'react-router-dom';
import { globalDisplayWindow, globalIsDisplayOpen, setGlobalDisplayWindow, setGlobalIsDisplayOpen } from '../utils/displayState';

export default function ControlPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const urlId = searchParams.get('id');

  const [newId] = useState('pl_' + Date.now());
  const playlistId = urlId === 'new' ? newId : urlId;
  const [playlistDate, setPlaylistDate] = useState(new Date().toISOString().split('T')[0]);
  const [localVidLoaded, setLocalVidLoaded] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean, version: string, url: string } | null>(null);
  const [quickEditFontSize, setQuickEditFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('quick_edit_font_size');
    return saved ? parseInt(saved) : 15;
  });

  useEffect(() => {
    fetch('https://api.github.com/repos/pisgahbisdac/pisgahbisdac/releases')
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(releases => {
        if (Array.isArray(releases) && releases.length > 0) {
          const latest = releases.find((r: any) => !r.draft && !r.prerelease);
          if (!latest) return;
          const latestVersion = (latest.name || latest.tag_name || '').replace(/^v/, '');
          if (isNewerVersion(latestVersion, CONFIG.APP_VERSION)) {
            setUpdateInfo({
              available: true,
              version: latestVersion,
              url: latest.html_url || 'https://github.com/pisgahbisdac/pisgahbisdac/releases'
            });
          }
        }
      })
      .catch(err => console.error('Failed to check for updates', err));
  }, []);

  const [playlist, setPlaylist] = useState<any[]>([]);
  const [playlistName, setPlaylistName] = useState('Memuat...');

  useEffect(() => {
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'PLAYLIST_UPDATE', payload: playlist });

    const handleMsg = (msg: MessageEvent) => {
      if (msg.data.type === 'REQUEST_PLAYLIST') {
        const ch = new BroadcastChannel('worship_live_sync');
        ch.postMessage({ type: 'PLAYLIST_UPDATE', payload: playlist });
        ch.close();
      }
    };
    channel.addEventListener('message', handleMsg);
    return () => {
      channel.removeEventListener('message', handleMsg);
      channel.close();
    };
  }, [playlist]);
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
  const segScrollRef = useRef<HTMLDivElement>(null);
  const [allSongTitles, setAllSongTitles] = useState<{ id: string, title: string }[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [liveCountdown, setLiveCountdown] = useState<{ id: string, start: number, duration: number } | null>(null);
  const [previewCountdown, setPreviewCountdown] = useState<number | null>(null);
  const [tempLiveItem, setTempLiveItem] = useState<any>(null);

  const [dbList, setDbList] = useState<DatabaseVersion[]>([]);
  const [selectedSongVersion, setSelectedSongVersion] = useState('song_LSEB');
  const [selectedBibleVersion, setSelectedBibleVersion] = useState('bible_TB');
  const [selectedBibleVersion2, setSelectedBibleVersion2] = useState('none');

  const [currentBg, setCurrentBg] = useState(localStorage.getItem('custom_bg') || '');
  const { getBgUrl, refreshBackgrounds } = useBackgrounds();

  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  const [dragSegItem, setDragSegItem] = useState<number | null>(null);
  const [dragOverSegItem, setDragOverSegItem] = useState<number | null>(null);

  const [showHotkeyHelp, setShowHotkeyHelp] = useState(false);

  // Theme state (Poin 4)
  const loadTheme = () => {
    try { return JSON.parse(localStorage.getItem('worship_display_theme') || '{}'); } catch { return {}; }
  };
  const [displayTheme, setDisplayTheme] = useState<{
    color?: string;
    fontSizeOffset?: number;
    position?: 'center' | 'top' | 'bottom';
    bold?: boolean;
    shadow?: 'dark' | 'light' | 'none';
    paddingHorizontal?: number;
    lineHeight?: number;
    titleOffsetY?: number;
    contentOffsetY?: number;
    headerTitleFontSizeOffset?: number;
    transitionStyle?: 'crossfade' | 'slideUp' | 'slideDown' | 'zoom';
    aspectRatio?: 'full' | '16:9' | '16:10' | '4:3';
    layout?: 'full' | 'lower-third';
    lowerThirdStyle?: 'dark-glass' | 'gradient' | 'minimal' | 'solid';
    blankImageUrl?: string;
    blankImageFit?: 'contain' | 'cover';
    logoScreenUrl?: string;
    backgroundDim?: number;
    enableVignette?: boolean;
  }>(loadTheme);

  const broadcastTheme = (newTheme: typeof displayTheme) => {
    localStorage.setItem('worship_display_theme', JSON.stringify(newTheme));
    const ch = new BroadcastChannel('worship_live_sync');
    ch.postMessage({ type: 'THEME_UPDATE', payload: newTheme });
    ch.close();
  };

  const updateTheme = (patch: Partial<typeof displayTheme>) => {
    const newTheme = { ...displayTheme, ...patch };
    setDisplayTheme(newTheme);
    broadcastTheme(newTheme);
  };

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
  const [searchType, setSearchType] = useState<'song' | 'bible' | 'announcement' | 'playlist'>('song');
  const [dashboardPlaylists, setDashboardPlaylists] = useState<any[]>([]);
  const [isLoadingDashboardPlaylists, setIsLoadingDashboardPlaylists] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentBibleBooks, setCurrentBibleBooks] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annSegments, setAnnSegments] = useState<string[]>(['']);
  const [annActiveSegment, setAnnActiveSegment] = useState(0);

  const [isDisplayOpen, setIsDisplayOpen] = useState(globalIsDisplayOpen);
  const displayWindowRef = useRef<Window | null>(globalDisplayWindow);
  const stageWindowRef = useRef<Window | null>(null);
  const [isStageOpen, setIsStageOpen] = useState(false);
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
      if (stageWindowRef.current && stageWindowRef.current.closed) {
        setIsStageOpen(false);
        stageWindowRef.current = null;
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

  // Ambil playlist dari server
  useEffect(() => {
    async function fetchPlaylist() {
      setIsLoading(true);
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
            try { rawItems = JSON.parse(rawItems); } catch (e) { }
          }
          if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
            rawItems = Array.isArray(rawItems.items) ? rawItems.items : Object.values(rawItems).filter(v => typeof v === 'object' && v !== null);
          }
          if (!Array.isArray(rawItems)) rawItems = [];

          const itemsWithVisibleSegments = await Promise.all(rawItems.map(async (item: any) => {
            if ((item.type === 'song' || item.type === 'bible') && item.customText) {
              try {
                const parsed = JSON.parse(item.customText);
                item.visibleSegments = Array.isArray(parsed) ? parsed : null;
              } catch (e) {
                item.visibleSegments = null;
              }
            } else if (!Array.isArray(item.visibleSegments)) {
              item.visibleSegments = null;
            }

            // Re-hydrate missing segments (in case backend stripped them to save space)
            if ((item.type === 'song' || item.type === 'bible') && (!item.segments || item.segments.length === 0)) {
              try {
                if (item.type === 'bible' && item.title) {
                  const res = await searchLocalBible(item.title, selectedBibleVersion || 'bible_TB');
                  if (res && res.length > 0) {
                    const bItem = res[0];
                    let segs = bItem.isRange ? bItem.segments : [bItem.text];
                    let labs = bItem.isRange ? bItem.segmentLabels : [`Ayat ${bItem.verse}`];
                    if (segs.length > 0 && segs[0] !== item.title) {
                      segs = [item.title, ...segs];
                      labs = ['Judul', ...labs];
                    }
                    item.segments = segs;
                    item.segmentLabels = labs;
                  } else {
                    item.segments = ['(Ayat tidak ditemukan di database lokal)'];
                  }
                } else if (item.type === 'song' && (item.refId || item.id)) {
                  const res = await searchLocalSongs(item.refId || item.id, selectedSongVersion || 'song_LSEB');
                  if (res && res.length > 0) {
                    let segs = res[0].segments || [];
                    let labs = res[0].segmentLabels || [];
                    if (segs.length > 0 && segs[0] !== res[0].title) {
                      segs = [res[0].title, ...segs];
                      labs = ['Judul', ...labs];
                    }
                    item.segments = segs;
                    item.segmentLabels = labs;
                  } else {
                    item.segments = ['(Lirik tidak ditemukan di database lokal)'];
                  }
                }
              } catch (e) {
                console.error("Gagal merehidrasi item", e);
              }
            }

            // Ensure title is prepended even if segments were loaded from backend (not rehydrated)
            if (item.type === 'song' || item.type === 'bible') {
              const bTitle = item.type === 'bible' ? (item.isRange ? item.title : (item.book ? `${item.book} ${item.chapter}:${item.verse}` : item.title)) : item.title;
              if (item.segments && item.segments.length > 0 && item.segments[0] !== bTitle && item.segments[0] !== item.title) {
                item.segments = [bTitle || item.title, ...item.segments];
                item.segmentLabels = ['Judul', ...(item.segmentLabels || item.segments.slice(1).map((_: any, i: number) => `Slide ${i + 1}`))];
                if (Array.isArray(item.visibleSegments) && item.visibleSegments.length > 0) {
                  item.visibleSegments = [0, ...item.visibleSegments.map((v: number) => v + 1)];
                }
              }
            }

            return item;
          }));
          setPlaylist(itemsWithVisibleSegments);
          setActiveItem(0);
          setActiveSegment(0);
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
    if (searchType === 'playlist' && dashboardPlaylists.length === 0) {
      setIsLoadingDashboardPlaylists(true);
      callApi('getPlaylists').then(res => {
        if (res && res.success) {
          setDashboardPlaylists(res.data);
        }
      }).catch(err => console.error(err)).finally(() => {
        setIsLoadingDashboardPlaylists(false);
      });
    }
  }, [searchType]);

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

  const [videoProgress, setVideoProgress] = useState<{ currentTime: number, duration: number } | null>(null);
  const [videoState, setVideoState] = useState<'play' | 'pause'>('pause');

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
        try { await callApi('setLiveState', {}, { method: 'POST', payload: stateObj }); } catch (err) { }
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
        try { await callApi('setLiveState', {}, { method: 'POST', payload: stateObj }); } catch (err) { }
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
    setDragOverItem(null);
  };

  const handleSegDrop = (e: React.DragEvent, dropVisualIdx: number, itemIdx: number) => {
    e.preventDefault();
    if (dragSegItem === null || dragSegItem === dropVisualIdx) return;

    const item = playlist[itemIdx];
    if (!item || !item.segments) return;

    const newVisibleSegments = [...getVisibleSegments(item)];

    const [draggedIdx] = newVisibleSegments.splice(dragSegItem, 1);
    newVisibleSegments.splice(dropVisualIdx, 0, draggedIdx);

    const newPlaylist = [...playlist];
    newPlaylist[itemIdx] = { ...item, visibleSegments: newVisibleSegments };
    setPlaylist(newPlaylist);
    saveRundown(newPlaylist);

    setDragSegItem(null);
    setDragOverSegItem(null);
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

    // Allow unlimited files, sort alphabetically to ensure correct slide order (Slide1.jpg, Slide2.jpg, etc)
    const selectedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isElectron = !!(window as any).electronAPI;

    const imageInfos = await Promise.all(selectedFiles.map(file => {
      return new Promise<{ url: string, width: number, height: number, file: File }>((resolve) => {
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
      // 1 or >2 files: one slide per segment
      segments.push(...savedIds);
    }

    const newItem = {
      id: 'image-' + Date.now(),
      type: 'image',
      title: imageInfos.length > 2 ? 'Slideshow / Gambar' : 'Gambar',
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
      try { await callApi('setLiveState', {}, { method: 'POST', payload: stateObj }); } catch (err) { }
    }, 200);

    e.target.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Simpan ke folder (Electron) atau IndexedDB (Web)
    setIsVideoUploading(true);
    try {
      const vidId = Date.now().toString();
      await saveLocalVideo(vidId, file);
      setVideoUrlInput(`local_vid_${vidId}`);
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
        const formattedResults = results.slice(0, 50).map(item => {
          let segs = item.segments || [];
          let labs = item.segmentLabels || segs.map((_: any, i: number) => `Slide ${i + 1}`);
          if (segs.length > 0 && segs[0] !== item.title) {
            segs = [item.title, ...segs];
            labs = ['Judul', ...labs];
          }
          return { ...item, segments: segs, segmentLabels: labs };
        });
        setSearchResults(formattedResults);
      } else {
        const results = await searchLocalBible(query, selectedBibleVersion);
        let results2: any[] = [];
        if (selectedBibleVersion2 !== 'none' && results.length > 0) {
          results2 = await getCrossLanguageVerses(results, selectedBibleVersion, selectedBibleVersion2);
        }

        const formattedResults = results.map((item: any, idx: number) => {
          const bTitle = item.isRange ? item.title : `${item.book} ${item.chapter}:${item.verse}`;
          let combinedSegments = item.isRange ? item.segments : [item.text];
          let labs = item.isRange ? item.segmentLabels : [`Ayat ${item.verse}`];

          if (results2.length > 0 && results2[idx]) {
            const item2 = results2[idx];
            const segs2 = item2.isRange ? item2.segments : [item2.text];
            combinedSegments = combinedSegments.map((seg: string, i: number) => {
              if (segs2[i]) return `${seg}\n[kuning]${segs2[i]}[/kuning]`;
              return seg;
            });
          }

          if (combinedSegments.length > 0 && combinedSegments[0] !== bTitle) {
            combinedSegments = [bTitle, ...combinedSegments];
            labs = ['Judul', ...labs];
          }

          return {
            id: item.isRange ? item.id : `b_${idx}`,
            type: 'bible',
            title: bTitle,
            author: 'Alkitab',
            category: 'Alkitab',
            segments: combinedSegments,
            segmentOrder: combinedSegments.map((_: any, i: number) => i),
            segmentLabels: labs
          };
        });
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
  }, [searchQuery, searchType, selectedBibleVersion, selectedBibleVersion2]);

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

  const handleQuickAddSong = async (id: string, playLive: boolean = false, withChorus: boolean = false) => {
    try {
      setIsSearching(true);
      const res = await searchLocalSongs(id, selectedSongVersion);
      if (res && res.length > 0) {
        // Find exact match just in case
        const exact = res.find((s: any) => s.id == id) || res[0];
        exact.type = 'song'; // Ensure type is explicitly set
        const processed = withChorus ? expandSongWithChorus(exact) : exact;

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
    setTempVisibleSegments(getVisibleSegments(playlist[idx]));
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
      displayWindowRef.current = window.open('#/display', 'worship_display_window', 'width=1280,height=720');
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
          } catch (e) { }
        }

        channel.close();
      }, 1500);
    }
  };

  const openStageDisplay = () => {
    if (stageWindowRef.current && !stageWindowRef.current.closed) {
      stageWindowRef.current.close();
      stageWindowRef.current = null;
      setIsStageOpen(false);
    } else {
      stageWindowRef.current = window.open('#/stage', 'worship_stage_window', 'width=1280,height=720');
      setIsStageOpen(true);
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

  const handleBlankUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 5MB.'); return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        updateTheme({ blankImageUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBlankImage = () => {
    updateTheme({ blankImageUrl: 'none' });
  };

  const handleResetBlankImage = () => {
    updateTheme({ blankImageUrl: undefined });
  };

  const handleLogoLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 5MB.'); return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateTheme({ logoScreenUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogoL = () => {
    updateTheme({ logoScreenUrl: 'none' });
  };

  const handleResetLogoL = () => {
    updateTheme({ logoScreenUrl: undefined });
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
    const visible = getVisibleSegments(item);
    const currentIdx = visible.indexOf(activeSegment);

    if (currentIdx !== -1 && currentIdx < visible.length - 1) {
      return { item: activeItem, segment: visible[currentIdx + 1] };
    } else if (activeItem < playlist.length - 1) {
      const nextItemIdx = activeItem + 1;
      const nextItem = playlist[nextItemIdx];
      const nextVisible = getVisibleSegments(nextItem);
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
    const visible = getVisibleSegments(item);
    const currentIdx = visible.indexOf(activeSegment);

    if (currentIdx !== -1 && currentIdx < visible.length - 1) {
      const nextSeg = visible[currentIdx + 1];
      setActiveSegment(nextSeg);
      pushStateToLive(activeItem, nextSeg, mode);
    } else if (activeItem < playlist.length - 1) {
      const nextItemIdx = activeItem + 1;
      setActiveItem(nextItemIdx);
      const nextItem = playlist[nextItemIdx];
      const nextVisible = getVisibleSegments(nextItem);
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
    const visible = getVisibleSegments(item);
    const currentIdx = visible.indexOf(activeSegment);

    if (currentIdx > 0) {
      const prevSeg = visible[currentIdx - 1];
      setActiveSegment(prevSeg);
      pushStateToLive(activeItem, prevSeg, mode);
    } else if (activeItem > 0) {
      const prevItemIdx = activeItem - 1;
      setActiveItem(prevItemIdx);
      const prevItem = playlist[prevItemIdx];
      const prevVisible = getVisibleSegments(prevItem);
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
        case '.': {
          e.preventDefault();
          const newMode = mode === 'blank' ? 'content' : 'blank';
          setMode(newMode);
          pushStateToLive(activeItem, activeSegment, newMode);
          break;
        }
        case 'l':
        case 'L': {
          e.preventDefault();
          const newMode = mode === 'logo' ? 'content' : 'logo';
          setMode(newMode);
          pushStateToLive(activeItem, activeSegment, newMode);
          break;
        }
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
  }, [playlist, activeItem, activeSegment, mode]);

  // Auto-scroll rundown ke item yang aktif
  useEffect(() => {
    const el = document.getElementById(`rundown-item-${activeItem}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeItem]);




  const renderDisplayBox = (itemIdx: number, segIdx: number, isLiveBox: boolean) => {
    const itemData = ((isLiveBox && tempLiveItem) || itemIdx === -2) ? tempLiveItem : playlist[itemIdx];
    if (!itemData) return <div className="w-full h-full bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center pointer-events-none"></div>;
    return (
      <div className={`w-full h-full rounded-xl overflow-hidden relative flex flex-col items-center justify-center pointer-events-none ${getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url === '#00FF00' ? 'bg-[#00FF00]' : 'bg-black'}`}
        style={getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.type === 'image' ? {
          containerType: 'inline-size',
          backgroundImage: (getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url && getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url !== '#00FF00') ? `url('${getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url}')` : 'none',
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
        {getBgUrl(itemData?.segmentBackgrounds?.[segIdx] || currentBg)?.url !== '#00FF00' && (
          <div className="absolute inset-0 bg-black/40 z-0"></div>
        )}

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
              if (url.startsWith('local_vid_') || url.startsWith('file://')) {
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
          {mode === 'content' && logos.length > 0 && itemData?.type !== 'countdown' && (
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

          {/* Control Panel Preview: Header Title */}
          {mode === 'content' && itemData?.type !== 'video' && itemData?.title && !itemData?.hideHeaderTitle && (itemData?.type === 'song' || itemData?.type === 'bible' || itemData?.type === 'announcement') && itemData?.segmentLabels?.[segIdx]?.toLowerCase() !== 'judul' && (
            <h2
              className="absolute left-0 right-0 w-full px-4 text-center font-heading font-bold text-yellow-300 opacity-90 tracking-wider z-20 transition-all duration-500"
              style={{
                top: `${6 + (displayTheme.titleOffsetY ?? 0)}%`,
                fontSize: `${1.5 + (displayTheme.headerTitleFontSizeOffset !== undefined ? displayTheme.headerTitleFontSizeOffset : 0.5) + (itemData?.headerTitleFontSizeOffset || 0)}cqw`,
                textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
              }}
            >
              {itemData?.title}
            </h2>
          )}

          {/* Content Container */}
          {itemData?.type !== 'video' && itemData?.type !== 'image' && (
            <div className={`absolute left-0 right-0 z-[70] flex flex-col items-center w-full min-h-0 transition-all duration-700 ${(displayTheme.position || 'center') === 'top' ? 'top-[8%] bottom-[12%] justify-start' :
              (displayTheme.position || 'center') === 'bottom' ? 'top-[18%] bottom-[8%] justify-end' :
                'top-[18%] bottom-[12%] justify-center'
              }`}
              style={{
                paddingLeft: `${displayTheme.paddingHorizontal ?? 8}%`,
                paddingRight: `${displayTheme.paddingHorizontal ?? 8}%`,
                marginTop: `${displayTheme.contentOffsetY ?? 0}%`
              }}>
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
                    key={`preview-${itemData?.title}-${segIdx}-${displayTheme.transitionStyle}`} // Force re-render on style change
                    className={`text-center whitespace-pre-wrap drop-shadow-xl w-full ${displayTheme.bold !== false ? 'font-bold' : 'font-medium'
                      }`}
                    style={{
                      lineHeight: displayTheme.lineHeight ? Math.min(1.25, Math.max(1.12, Number(displayTheme.lineHeight))) : 1.16,
                      color: displayTheme.color || 'white',
                      textShadow: (displayTheme.shadow || 'dark') === 'dark'
                        ? '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 0 4px 10px rgba(0,0,0,0.8)'
                        : (displayTheme.shadow === 'light')
                          ? '1px 1px 2px #fff, -1px -1px 2px #fff, 1px -1px 2px #fff, -1px 1px 2px #fff, 0 4px 10px rgba(255,255,255,0.8)'
                          : 'none',
                      animation: (() => {
                        if (displayTheme.transitionStyle === 'slideUp') return 'slideUpIn 0.5s ease-out forwards';
                        if (displayTheme.transitionStyle === 'slideDown') return 'slideDownIn 0.5s ease-out forwards';
                        if (displayTheme.transitionStyle === 'zoom') return 'zoomInIn 0.5s ease-out forwards';
                        return 'fadeIn 0.5s ease-out forwards';
                      })(),
                      fontSize: `${calculateOptimalFontSize(itemData?.segments[segIdx] || '', {
                        is2Column: (itemData?.segments[segIdx] || '').includes('\n[kuning]') || (itemData?.segments[segIdx] || '').includes('\n[kolom2]'),
                        isLowerThird: displayTheme.layout === 'lower-third',
                        lineHeight: Number(displayTheme.lineHeight) || 1.16,
                        fontSizeOffset: displayTheme.fontSizeOffset || 0
                      })}cqw`
                    }}
                    dangerouslySetInnerHTML={{ __html: processText(itemData?.segments[segIdx] || '') }}
                  />

                  {/* Subtitle (Bait) di bawah isi */}
                  {(() => {
                    let label = itemData?.segmentLabels?.[segIdx] || '';
                    if (itemData?.type === 'bible' && !label) {
                      const match = itemData?.title?.match(/(.+?)\s*:\s*(\d+)/);
                      if (match) {
                        const startVerse = parseInt(match[2], 10);
                        label = `Ayat ${startVerse + segIdx}`;
                      } else {
                        label = `Ayat ${segIdx + 1}`;
                      }
                    }
                    if (itemData?.type === 'song' && label.startsWith('Slide ')) {
                      label = label.replace('Slide ', 'Bait ');
                    }

                    if (label.toLowerCase() === 'judul') return null;

                    return (
                      <div
                        className="text-yellow-300 font-bold mt-[1.5cqw] tracking-widest uppercase opacity-80 animate-fade-in"
                        style={{
                          fontSize: '1.5cqw',
                          textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 10px rgba(0,0,0,0.9)',
                          minHeight: '2cqw'
                        }}
                      >
                        {label || (itemData?.type === 'song' ? '•' : '')}
                      </div>
                    );
                  })()}
                </>
              ) : null}
            </div>
          )}

          {/* End of Safe Area */}
        </div>

        {/* Running Text Bar in Preview */}
        {isRtVisible && runningText && (
          <div
            className={`absolute left-0 right-0 z-30 bg-black/60 backdrop-blur-sm border-y border-white/10 overflow-hidden flex items-center ${rtPos === 'top' ? 'top-0' : 'bottom-0'
              }`}
            style={{ height: `${((rtHeight || 7) / 56.25) * 100}%` }}
          >
            {(() => {
              const rtSeparator = '\u00A0\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0\u00A0\u00A0';
              const formattedRtText = runningText ? runningText.split('\n').filter((t: string) => t.trim() !== '').join(rtSeparator) : '';
              const rtBlockText = formattedRtText ? Array(15).fill(formattedRtText).join(rtSeparator) + rtSeparator : '';
              const rtCharCount = rtBlockText.length;
              const speedMultiplier = Math.max(5, (rtSpeed || 15));
              const calculatedDuration = Math.max(5, (rtCharCount / 100) * speedMultiplier);
              return (
                <div className="animate-marquee-seamless shrink-0" style={{ animationDuration: `${calculatedDuration}s` }}>
                  <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${((rtHeight || 7) / 56.25 * 100) * 0.35}cqw` }}>
                    {rtBlockText}
                  </div>
                  <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${((rtHeight || 7) / 56.25 * 100) * 0.35}cqw` }}>
                    {rtBlockText}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Layar Logo Mode Overlay (Hotkey L) */}
        {mode === 'logo' && (
          <div className="absolute inset-0 z-[998] flex items-center justify-center overflow-hidden animate-fade-in bg-black/40">
            {displayTheme.logoScreenUrl !== 'none' && (
              <img
                src={displayTheme.logoScreenUrl || import.meta.env.BASE_URL + "logo.png"}
                alt="Layar Logo"
                style={{ width: '35%', maxWidth: '450px' }}
                className="object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] drop-shadow-[0_0_50px_rgba(197,160,89,0.45)]"
              />
            )}
          </div>
        )}

        {/* Blank Mode Overlay (Hotkey B) */}
        {mode === 'blank' && (
          <div className="absolute inset-0 bg-black z-[999] flex items-center justify-center overflow-hidden">
            {displayTheme.blankImageUrl !== 'none' && (
              <img
                src={displayTheme.blankImageUrl || import.meta.env.BASE_URL + "blank_logo.png"}
                alt="Blank Logo"
                className={displayTheme.blankImageFit === 'cover'
                  ? "w-full h-full object-cover animate-fade-in"
                  : "max-h-[50%] max-w-[50%] object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] drop-shadow-[0_0_50px_rgba(197,160,89,0.45)] animate-fade-in"
                }
              />
            )}
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
          <div className="flex flex-col">
            <h1 className="text-xl font-heading font-extrabold text-indigo-900 dark:text-[#C5A059] tracking-tight drop-shadow-sm flex items-center">
              WorshipPresenter
            </h1>
            <span className="text-[10px] font-bold text-indigo-900/50 dark:text-[#C5A059]/50 -mt-1 tracking-widest">
              v{CONFIG.APP_VERSION}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {updateInfo && updateInfo.available && (
            <a
              href={updateInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors text-xs font-bold shadow-md animate-pulse"
              title="Unduh versi terbaru di GitHub"
            >
              🚀 Update v{updateInfo.version} Tersedia!
            </a>
          )}
          <button
            onClick={() => setShowHotkeyHelp(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors text-xs font-bold"
            title="Bantuan Pintasan Keyboard"
          >
            <Keyboard size={16} /> Hotkeys
          </button>
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
        <aside className="w-[20%] glass-panel flex flex-col gap-3 p-3 shadow-lg border-white/50 overflow-y-auto">
          <button onClick={() => navigate('/dashboard')} className="glass-button w-full text-indigo-900 flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all hover:bg-white/70">
            DASHBOARD
          </button>

          <div className="w-full h-px bg-indigo-900/10 my-1"></div>

          <button onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('add'); if (searchType === 'playlist') setSearchType('song'); }} className={`glass-button w-full text-indigo-900 flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all ${displayPanelTab === 'add' && searchType !== 'playlist' ? 'bg-white/80 shadow-md' : 'hover:bg-white/70'}`}>
            LAGU / ALKITAB
          </button>
          <button onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('add'); setSearchType('playlist'); }} className={`glass-button w-full text-indigo-900 flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all ${displayPanelTab === 'add' && searchType === 'playlist' ? 'bg-white/80 shadow-md' : 'hover:bg-white/70'}`}>
            PLAYLIST
          </button>

          <div className="w-full h-px bg-indigo-900/10 my-1"></div>

          <div className="mt-auto flex flex-col gap-2">
            {/* Quick Edit Panel (Left Sidebar) */}
            {(() => {
              const item = tempLiveItem ? tempLiveItem : playlist[activeItem];
              const segIdx = tempLiveItem ? liveSegment : activeSegment;
              const isEditable = item && (item.type === 'song' || item.type === 'bible' || item.type === 'announcement') && item.segments && item.segments[segIdx] !== undefined;

              if (isEditable) {
                const nextInfo = getNextSlideInfo();
                let nextItemData: any = null;
                let nextItemIdx = -1;
                let nextSegIdx = -1;

                if (nextInfo.item !== -1) {
                  if (nextInfo.item === -2) {
                    nextItemData = tempLiveItem;
                    nextItemIdx = -2;
                  } else {
                    nextItemData = playlist[nextInfo.item];
                    nextItemIdx = nextInfo.item;
                  }
                  nextSegIdx = nextInfo.segment;
                }

                const isNextEditable = nextItemData && (nextItemData.type === 'song' || nextItemData.type === 'bible' || nextItemData.type === 'announcement') && nextItemData.segments && nextItemData.segments[nextSegIdx] !== undefined;

                const updateSegmentText = (targetSegIdx: number, newText: string, targetItemIdx: number = activeItem) => {
                  if (targetItemIdx === -2 || (tempLiveItem && targetItemIdx === activeItem)) {
                    if (!tempLiveItem) return;
                    const updated = { ...tempLiveItem, segments: [...tempLiveItem.segments] };
                    updated.segments[targetSegIdx] = newText;
                    setTempLiveItem(updated);
                    // Push state secara instan jika kita di mode live/content
                    if (mode === 'content') {
                      pushTempToLive(updated, liveSegment);
                    }
                  } else {
                    const newPlaylist = [...playlist];
                    if (!newPlaylist[targetItemIdx]) return;
                    newPlaylist[targetItemIdx] = { ...newPlaylist[targetItemIdx], segments: [...newPlaylist[targetItemIdx].segments] };
                    newPlaylist[targetItemIdx].segments[targetSegIdx] = newText;
                    setPlaylist(newPlaylist);
                    if (targetItemIdx === liveItem && mode === 'content') {
                      const stateObj = {
                        playlistId: playlistId,
                        currentItemId: newPlaylist[targetItemIdx].id,
                        segmentIndex: liveSegment, // selalu kirim segment yang sedang aktif ditayangkan
                        displayMode: 'content',
                        item: newPlaylist[targetItemIdx],
                        updatedAt: Date.now()
                      };
                      const channel = new BroadcastChannel('worship_live_sync');
                      channel.postMessage({ type: 'STATE_UPDATE', state: stateObj });
                      channel.close();

                      if (syncTimeout.current) clearTimeout(syncTimeout.current);
                      syncTimeout.current = setTimeout(async () => {
                        try {
                          await callApi('setLiveState', {}, { method: 'POST', payload: stateObj });
                          setIsSyncing(false);
                        } catch (e) { }
                      }, 1000);
                    }
                  }
                };

                return (
                  <div className="flex flex-col gap-2 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-indigo-200 dark:border-slate-700/60 shadow-sm mb-2 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Edit size={13} className="text-indigo-600 dark:text-[#C5A059]" /> Quick Edit
                      </span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg p-0.5 border border-indigo-100 dark:border-slate-700 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setQuickEditFontSize(prev => {
                            const next = Math.max(12, prev - 1);
                            localStorage.setItem('quick_edit_font_size', String(next));
                            return next;
                          })}
                          className="px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                          title="Perkecil Ukuran Font"
                        >
                          A-
                        </button>
                        <span className="text-[10px] font-bold font-mono text-indigo-600 dark:text-[#C5A059] px-1 min-w-[26px] text-center">
                          {quickEditFontSize}px
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuickEditFontSize(prev => {
                            const next = Math.min(24, prev + 1);
                            localStorage.setItem('quick_edit_font_size', String(next));
                            return next;
                          })}
                          className="px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                          title="Perbesar Ukuran Font"
                        >
                          A+
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                      {/* Current Slide */}
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-700 dark:text-[#D4B872] uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-[#C5A059]"></span>
                            Saat Ini (Slide {segIdx + 1})
                          </span>
                        </div>
                        <SegmentEditor
                          value={item.segments[segIdx]}
                          onChange={(val: string) => updateSegmentText(segIdx, val, tempLiveItem ? -2 : activeItem)}
                          style={{ fontSize: `${quickEditFontSize}px` }}
                          className="w-full bg-white dark:bg-slate-800 border-2 border-indigo-200/80 dark:border-white/10 rounded-xl p-2.5 leading-relaxed font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-[#C5A059]/40 resize-none overflow-hidden custom-scrollbar transition-all shadow-xs"
                        />
                      </div>

                      {/* Next Slide */}
                      {nextItemData && (
                        <div className="flex flex-col gap-1 w-full mt-1 border-t border-indigo-100 dark:border-slate-700/60 pt-2">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {nextItemIdx === (tempLiveItem ? -2 : activeItem) ? `Selanjutnya (Slide ${nextSegIdx + 1})` : `Rundown Berikutnya`}
                          </span>
                          {isNextEditable ? (
                            <SegmentEditor
                              value={nextItemData.segments[nextSegIdx]}
                              onChange={(val: string) => updateSegmentText(nextSegIdx, val, nextItemIdx)}
                              style={{ fontSize: `${quickEditFontSize}px` }}
                              className="w-full bg-white/80 dark:bg-slate-800/70 border border-indigo-100 dark:border-white/10 rounded-xl p-2.5 leading-relaxed font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:focus:ring-[#C5A059]/40 resize-none overflow-hidden custom-scrollbar transition-all shadow-xs"
                            />
                          ) : (
                            <div className="w-full bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-xs">
                              <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">{nextItemData.type === 'video' ? 'Video' : nextItemData.type === 'image' ? 'Gambar' : nextItemData.type === 'countdown' ? 'Timer' : nextItemData.type || 'Media'}</span>
                              <span className="truncate">{nextItemData.title || 'Item Media'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <button
              onClick={() => {
                if (displayPanelTab === 'add' || !isRunningTextModalOpen) {
                  setIsRunningTextModalOpen(true);
                  setDisplayPanelTab('rt');
                } else {
                  setIsRunningTextModalOpen(false);
                }
              }}
              className={`glass-button w-full flex items-center justify-center font-bold px-2 py-4 text-[11px] uppercase tracking-wider transition-all ${(isRunningTextModalOpen && displayPanelTab !== 'add') ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md border-indigo-500' : isRtVisible ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-md border-indigo-300' : 'bg-white/50 text-indigo-900 hover:bg-white/70 border-white/40'
                }`}
            >
              LAYOUT
            </button>
          </div>
        </aside>


        {/* Center Workspace (Dual Display + Controls) */}
        <section className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">

          {/* Dual Display Area */}
          <div className="flex gap-4 shrink-0 max-h-[55%]">
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
                <button onClick={handlePrev} className="flex bg-[#D4B872]/10 border border-[#C5A059] text-[#C5A059] justify-center items-center gap-1.5 px-4 py-2 font-bold uppercase text-[11px] hover:bg-[#C5A059]/20 rounded-lg transition-all"><ArrowLeft size={14} /> PREV</button>
                <button onClick={handleNext} className="flex bg-[#D4B872]/10 border border-[#C5A059] text-[#C5A059] justify-center items-center gap-1.5 px-4 py-2 font-bold uppercase text-[11px] hover:bg-[#C5A059]/20 rounded-lg transition-all">NEXT <ArrowRight size={14} /></button>
              </div>

              {/* Middle: Bait Buttons (Kotak Khusus) */}
              {(() => {
                const item = tempLiveItem ? tempLiveItem : playlist[activeItem];
                const seg = tempLiveItem ? liveSegment : activeSegment;

                return item?.segments && item.segments.length > 1 ? (
                  <div className="flex-1 bg-transparent border border-indigo-500/30 dark:border-white/20 rounded-xl p-1 flex items-center min-w-0 relative">
                    {/* Left Scroll Button */}
                    <button
                      type="button"
                      onClick={() => {
                        segScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
                      }}
                      className="shrink-0 p-1 text-slate-400 hover:text-[#C5A059] hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
                      title="Geser ke Kiri (atau gunakan Scroll Roda Mouse)"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div
                      ref={segScrollRef}
                      onWheel={(e) => {
                        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
                        if (delta !== 0) {
                          e.currentTarget.scrollLeft += delta * 1.3;
                        }
                      }}
                      className="flex-1 flex items-center gap-1.5 overflow-x-auto min-w-0 custom-scrollbar py-1 px-1 scroll-smooth"
                    >
                      {getVisibleSegments(item).map((idx: number, visualIdx: number) => {
                        const isSelected = seg === idx && mode === 'content';
                        return (
                          <button
                            key={`${idx}-${visualIdx}`}
                            ref={(el) => {
                              if (el && isSelected) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                              }
                            }}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', visualIdx.toString());
                              setDragSegItem(visualIdx);
                            }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverSegItem(visualIdx); }}
                            onDrop={(e) => handleSegDrop(e, visualIdx, tempLiveItem ? liveItem : activeItem)}
                            onDragEnd={() => { setDragSegItem(null); setDragOverSegItem(null); }}
                            onDragLeave={() => setDragOverSegItem(null)}
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
                            className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition-all duration-200 border shrink-0 whitespace-nowrap ${dragOverSegItem === visualIdx && dragSegItem !== visualIdx
                              ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 text-blue-800 dark:text-blue-200 shadow-[0_0_10px_rgba(96,165,250,0.4)]'
                              : isSelected
                                ? 'bg-[#C5A059] text-black border-transparent shadow-[0_0_10px_rgba(197,160,89,0.3)]'
                                : 'bg-transparent text-slate-500 dark:text-[#C5A059]/60 border-slate-300 dark:border-[#C5A059]/30 hover:bg-slate-200 dark:hover:bg-[#C5A059]/10 hover:text-slate-800 dark:hover:text-[#C5A059]'
                              } ${dragSegItem === visualIdx ? 'opacity-30' : ''}`}
                          >
                            {item?.segmentLabels ? item.segmentLabels[idx] : `Slide ${idx + 1}`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Scroll Button */}
                    <button
                      type="button"
                      onClick={() => {
                        segScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
                      }}
                      className="shrink-0 p-1 text-slate-400 hover:text-[#C5A059] hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
                      title="Geser ke Kanan (atau gunakan Scroll Roda Mouse)"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : item?.type === 'video' ? (
                  <div className="flex-1 flex flex-col justify-center items-center px-4 w-full h-full min-w-0">
                    <div className="flex justify-center items-center gap-3 w-full max-w-lg">
                      <button onClick={toggleVideoPlay} className="flex bg-[#C5A059] text-black justify-center items-center gap-2 px-4 py-2 font-extrabold uppercase text-[11px] hover:bg-[#D4B872] rounded-lg transition-all shadow-[0_0_15px_rgba(197,160,89,0.3)] shrink-0">
                        {videoState === 'play' ? <><Pause size={14} className="fill-black" /> PAUSE</> : <><Play size={14} className="fill-black" /> PLAY</>}
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
                <button onClick={openStageDisplay} className="flex bg-transparent border border-slate-600 text-slate-300 justify-center items-center gap-2 px-3 py-2 font-bold text-[11px] hover:bg-slate-800 rounded-lg transition-all" title="Buka Tampilan Panggung Pemimpin">
                  <Monitor size={14} /> Pemimpin
                </button>
                <button onClick={openDisplay} className="flex bg-transparent border border-slate-600 text-slate-300 justify-center items-center gap-2 px-4 py-2 font-bold text-[11px] hover:bg-slate-800 rounded-lg transition-all">
                  <Monitor size={14} /> {isDisplayOpen ? 'Tutup Layar' : 'Buka Layar'}
                </button>
                <button
                  onClick={() => {
                    const newMode = mode === 'blank' ? 'content' : 'blank';
                    setMode(newMode);
                    pushStateToLive(activeItem, activeSegment, newMode);
                  }}
                  className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all uppercase ${mode === 'blank'
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
                  <Play size={12} className="fill-black" /> TAMPILKAN LIVE
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
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${displayPanelTab === 'rt'
                    ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm'
                    : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                    }`}
                >Running Text</button>
                <button
                  onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('bg'); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${displayPanelTab === 'bg'
                    ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm'
                    : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                    }`}
                >Background</button>
                <button
                  onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('logo'); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${displayPanelTab === 'logo'
                    ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm'
                    : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                    }`}
                >Logo / Watermark</button>
                <button
                  onClick={() => { setIsRunningTextModalOpen(true); setDisplayPanelTab('theme'); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${displayPanelTab === 'theme'
                    ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-sm'
                    : 'bg-white/50 dark:bg-slate-800/80 text-indigo-900 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80 border border-indigo-200 dark:border-slate-700'
                    }`}
                >Tema Display</button>
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
                    <QuickSearchPanel
                      searchType={searchType === 'playlist' ? 'playlist' : searchType === 'bible' ? 'bible' : 'song'}
                      setSearchType={(t) => { setSearchType(t); setSearchQuery(''); }}
                      selectedSongVersion={selectedSongVersion}
                      setSelectedSongVersion={setSelectedSongVersion}
                      selectedBibleVersion={selectedBibleVersion}
                      setSelectedBibleVersion={setSelectedBibleVersion}
                      selectedBibleVersion2={selectedBibleVersion2}
                      setSelectedBibleVersion2={setSelectedBibleVersion2}
                      dbList={dbList}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      onSearch={handleSearch}
                      isSearching={isSearching}
                      dashboardPlaylists={dashboardPlaylists}
                      isLoadingDashboardPlaylists={isLoadingDashboardPlaylists}
                      searchResults={searchResults}
                      allSongTitles={allSongTitles}
                      currentBibleBooks={currentBibleBooks}
                      onNavigateToPlaylist={(id) => navigate('/control?id=' + id)}
                      onAddToRundown={addToRundown}
                      onPushTempToLive={pushTempToLive}
                      onQuickAddSong={handleQuickAddSong}
                      onDirectSearch={(query, type) => performSearch(query, type)}
                    />
                  )}
                  {displayPanelTab === 'rt' && (
                    <RunningTextPanel
                      isRtVisible={isRtVisible}
                      setIsRtVisible={setIsRtVisible}
                      runningText={runningText}
                      setRunningText={setRunningText}
                      rtHeight={rtHeight}
                      setRtHeight={setRtHeight}
                      rtSpeed={rtSpeed}
                      setRtSpeed={setRtSpeed}
                      rtPos={rtPos}
                      setRtPos={setRtPos}
                    />
                  )}

                  {displayPanelTab === 'logo' && (
                    <LogoManagerPanel
                      logos={logos}
                      updateLogo={updateLogo}
                      removeLogo={removeLogo}
                      onLogoUpload={handleLogoUpload}
                    />
                  )}

                  {displayPanelTab === 'bg' && (
                    <div className="h-full">
                      <BackgroundPickerInline
                        onSelect={handleGlobalBackgroundSelect}
                        currentBgUrl={localStorage.getItem('custom_bg')}
                      />
                    </div>
                  )}

                  {displayPanelTab === 'theme' && (
                    <ThemeSettingsPanel
                      displayTheme={displayTheme}
                      updateTheme={updateTheme}
                      onBlankUpload={handleBlankUpload}
                      onLogoLUpload={handleLogoLUpload}
                      onRemoveLogoL={handleRemoveLogoL}
                      onResetLogoL={handleResetLogoL}
                      onRemoveBlankImage={handleRemoveBlankImage}
                      onResetBlankImage={handleResetBlankImage}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right Sidebar (Rundown / Setlist) */}
        <aside className="w-[20%] glass-panel p-4 flex flex-col overflow-hidden shadow-lg border-white/50">
          <div className="mb-4 flex flex-col w-full gap-2">
            <div className="w-full">
              <FooterClock />
            </div>
            <div className="flex gap-2 w-full">
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
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-1 rounded-lg text-[10px] font-bold shadow-md shadow-indigo-600/30 transition flex justify-center items-center uppercase tracking-wider text-center leading-tight"
              >
                Simpan
              </button>

              <label className="flex-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-2 px-1 rounded-lg text-[10px] font-bold shadow-sm transition flex justify-center items-center uppercase tracking-wider text-center leading-tight cursor-pointer">
                Import
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
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-all shadow-sm font-bold shrink-0 ${isEditingRundown
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30'
                : 'glass-button bg-white text-indigo-900 hover:bg-white/80 border-white'
                }`}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : (isEditingRundown ? <Save size={14} /> : <Edit size={14} />)}
              {isEditingRundown ? 'Simpan' : 'Edit'}
            </button>
          </div>
          <div className="text-xs font-bold text-indigo-900/50 dark:text-indigo-200/50 mb-2 uppercase tracking-wider flex items-center justify-between">
            <span>RUNDOWN</span>
            {tempLiveItem && (
              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Live Sementara
              </span>
            )}
          </div>

          {tempLiveItem && (
            <div className="mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] font-semibold flex items-center justify-between gap-2 shadow-xs shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0"></span>
                <span className="truncate">Live: <strong>{tempLiveItem.title || 'Item Cepat'}</strong></span>
              </div>
              <button
                onClick={() => {
                  setTempLiveItem(null);
                  pushStateToLive(activeItem, activeSegment, playlist[activeItem]?.type === 'video' ? 'logo' : 'content');
                }}
                className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 shrink-0 transition"
                title="Kembali ke Rundown"
              >
                Ke Rundown
              </button>
            </div>
          )}

          <div className="space-y-2 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="animate-spin text-indigo-600 dark:text-[#C5A059]" size={36} />
              </div>
            ) : playlist.length === 0 ? (
              <div className="text-center text-sm font-semibold text-indigo-900/40 dark:text-indigo-200/40 mt-10">Rundown kosong.</div>
            ) : playlist.map((item, idx) => {
              const isCurrentLive = liveItem === idx && !tempLiveItem;
              const isCurrentActive = activeItem === idx;

              return (
                <div
                  id={`rundown-item-${idx}`}
                  key={item.id || idx}
                  className={`flex gap-2 transition-all duration-200 ${dragItem === idx ? 'opacity-30 scale-95' :
                    dragOverItem === idx ? '' : 'hover:-translate-y-0.5'
                    }`}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', idx.toString());
                    setDragItem(idx);
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverItem(idx); }}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={() => { setDragItem(null); setDragOverItem(null); }}
                  onDragLeave={() => setDragOverItem(null)}
                >
                  <div
                    onClick={() => {
                      const visible = getVisibleSegments(item);
                      const seg = visible.length > 0 ? visible[0] : 0;

                      setActiveItem(idx);
                      setActiveSegment(seg);
                      setTempLiveItem(null);
                      const newMode = item.type === 'video' ? 'logo' : 'content';
                      setMode(newMode);
                    }}
                    onDoubleClick={() => {
                      const visible = getVisibleSegments(item);
                      const seg = visible.length > 0 ? visible[0] : 0;
                      setActiveItem(idx);
                      setActiveSegment(seg);
                      setTempLiveItem(null);
                      pushStateToLive(idx, seg, item.type === 'video' ? 'logo' : 'content');
                    }}
                    className={`flex-1 text-left p-3 rounded-xl border-2 backdrop-blur-sm transition-all cursor-pointer ${dragOverItem === idx && dragItem !== idx
                      ? 'border-blue-400 dark:border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.5)] bg-blue-50/40 dark:bg-blue-900/20'
                      : isCurrentLive && isCurrentActive
                        ? 'bg-red-500/15 dark:bg-red-950/40 border-red-500 shadow-lg shadow-red-500/20 border-l-[6px] border-l-red-600 relative z-10'
                        : isCurrentLive
                          ? 'bg-red-500/10 dark:bg-red-950/25 border-red-500/80 shadow-md shadow-red-500/15 border-l-[6px] border-l-red-500 relative z-10'
                          : isCurrentActive
                            ? 'bg-white dark:bg-[#C5A059]/10 border-indigo-400 dark:border-[#C5A059] shadow-md shadow-indigo-500/10 dark:shadow-[0_0_15px_rgba(197,160,89,0.3)] border-l-[6px] border-l-indigo-500 dark:border-l-[#C5A059] relative z-10'
                            : 'bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/60 dark:hover:bg-white/10 hover:border-white dark:hover:border-white/20 shadow-sm border-l-2 border-l-transparent'
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-indigo-300 dark:text-slate-600 shrink-0 mt-0.5 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between w-full items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-bold text-sm leading-tight line-clamp-2 ${isCurrentLive
                                ? 'text-red-950 dark:text-red-200'
                                : isCurrentActive
                                  ? 'text-indigo-900 dark:text-[#D4B872]'
                                  : 'text-indigo-900/80 dark:text-indigo-200/70'
                                }`}>
                                {idx + 1}. {item.title || item.name || '(Tanpa Judul)'}
                              </span>
                              {isCurrentLive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white shadow-xs shadow-red-600/40 animate-pulse shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                  LIVE
                                </span>
                              )}
                              {isCurrentActive && !isCurrentLive && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                  PREVIEW
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {!isCurrentLive ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const visible = getVisibleSegments(item);
                                  const seg = visible.length > 0 ? visible[0] : 0;
                                  setActiveItem(idx);
                                  setActiveSegment(seg);
                                  setTempLiveItem(null);
                                  pushStateToLive(idx, seg, item.type === 'video' ? 'logo' : 'content');
                                }}
                                className="text-red-600 hover:text-white hover:bg-red-600 bg-red-500/10 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white p-1.5 rounded-lg transition-colors shrink-0 shadow-xs"
                                title="Tayangkan langsung ke layar proyektor (Live)"
                              >
                                <Play size={13} className="fill-current" />
                              </button>
                            ) : (
                              <span
                                className="bg-red-600 text-white p-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center shrink-0 shadow-xs"
                                title="Sedang tayang di layar proyektor (LIVE)"
                              >
                                <Monitor size={13} />
                              </span>
                            )}

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${isCurrentLive
                              ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800/50'
                              : 'text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40'
                              }`}>
                              {item.type}
                            </div>

                            {isCurrentLive && (
                              <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                Slide {liveSegment + 1}{item.segmentLabels && item.segmentLabels[liveSegment] ? `: ${item.segmentLabels[liveSegment]}` : ''}
                              </span>
                            )}
                          </div>

                          {item.type === 'countdown' && (
                            <div className="text-[10px] font-bold text-indigo-900/50 dark:text-indigo-200/50 uppercase">
                              {Math.floor(parseInt(item.segments[0] || '0') / 60)}:{(parseInt(item.segments[0] || '0') % 60).toString().padStart(2, '0')}
                            </div>
                          )}

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
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-900/10 shrink-0">
            {replaceIndex !== null && (
              <div className="mb-2 bg-indigo-100 text-indigo-900 text-xs p-2 rounded-lg border border-indigo-200 flex justify-between items-center">
                <span className="truncate pr-2">Ganti: <strong>{playlist[replaceIndex]?.title}</strong></span>
                <button onClick={() => setReplaceIndex(null)} className="text-red-500 hover:bg-red-500/10 p-1 rounded shrink-0"><X size={12} /></button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={addQuickAnnouncement}
                className="w-full glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-1.5 text-indigo-900 py-2 text-[11px] font-semibold hover:bg-white/70 transition-all"
                title="Tambah Teks / Pengumuman"
              >
                <Plus size={14} /> TEKS
              </button>
              <button
                onClick={() => openVideoModal(replaceIndex)}
                className="w-full glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-1.5 text-indigo-900 py-2 text-[11px] font-semibold hover:bg-white/70 transition-all"
                title="Tambah Video"
              >
                <Video size={16} /> VIDEO
              </button>
              <button
                onClick={() => { setReplaceIndex(replaceIndex); document.getElementById('rundown-img-upload')?.click(); }}
                className="w-full glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-1.5 text-indigo-900 py-2 text-[11px] font-semibold hover:bg-white/70 transition-all"
                title="Tambah Gambar atau File Presentasi (Bisa pilih banyak)"
              >
                <ImageIcon size={16} /> GAMBAR / SLIDESHOW
              </button>
              <button
                onClick={addCountdown}
                className="w-full glass-button border-indigo-300 border-dashed border-2 flex justify-center items-center gap-1.5 text-indigo-900 py-2 text-[11px] font-semibold hover:bg-white/70 transition-all"
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

          </div>
        </aside>
      </main>
      {/* Hotkey Help Modal */}
      <HotkeyHelpModal
        isOpen={showHotkeyHelp}
        onClose={() => setShowHotkeyHelp(false)}
      />

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrlInput={videoUrlInput}
        setVideoUrlInput={setVideoUrlInput}
        isVideoUploading={isVideoUploading}
        isVideoLoop={isVideoLoop}
        isVideoMuted={isVideoMuted}
        onVideoUpload={handleVideoUpload}
        setIsVideoLoop={setIsVideoLoop}
        setIsVideoMuted={setIsVideoMuted}
        onSubmit={handleVideoSubmit}
      />
      {/* MODAL GANTI BACKGROUND */}
      <BackgroundPickerModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        onSelect={handleGlobalBackgroundSelect}
        currentBgUrl={localStorage.getItem('custom_bg')}
      />

      {/* LOGO MODAL */}



      {/* SEGMENT SELECTION MODAL */}
      <SegmentModal
        isOpen={isSegmentModalOpen && segmentEditIndex !== null}
        onClose={() => setIsSegmentModalOpen(false)}
        segments={segmentEditIndex !== null && playlist[segmentEditIndex] ? (playlist[segmentEditIndex].originalSegments || playlist[segmentEditIndex].segments) : []}
        tempVisibleSegments={tempVisibleSegments}
        onToggleSegment={toggleSegment}
        onSave={saveSegmentSelection}
        canEmbedChorus={Boolean(
          segmentEditIndex !== null &&
          playlist[segmentEditIndex]?.type === 'song' &&
          hasChorus(playlist[segmentEditIndex]) &&
          !isChorusAlreadyEmbedded(playlist[segmentEditIndex].segments, playlist[segmentEditIndex].segmentLabels)
        )}
        onEmbedChorus={() => {
          if (segmentEditIndex !== null && playlist[segmentEditIndex]) {
            const expanded = expandSongWithChorus(playlist[segmentEditIndex]);
            setPlaylist(prev => {
              const pl = [...prev];
              pl[segmentEditIndex] = expanded;
              return pl;
            });
            setTempVisibleSegments(expanded.segments.map((_: any, i: number) => i));
          }
        }}
      />

      {/* COUNTDOWN MODAL */}
      <CountdownModal
        isOpen={isCountdownModalOpen}
        onClose={() => setIsCountdownModalOpen(false)}
        value={countdownInputValue}
        onChange={setCountdownInputValue}
        onSubmit={handleCountdownSubmit}
      />

      {/* EDIT ITEM MODAL */}
      <EditItemModal
        isOpen={editItemIndex !== null && editItemIndex >= 0 && editItemIndex < playlist.length}
        item={editItemIndex !== null ? playlist[editItemIndex] : null}
        itemIndex={editItemIndex}
        editSegmentIndex={editSegmentIndex}
        setEditSegmentIndex={setEditSegmentIndex}
        onUpdateItem={(idx, updatedItem) => {
          setPlaylist(prev => {
            const pl = [...prev];
            pl[idx] = updatedItem;
            return pl;
          });
          if (activeItem === idx) {
            pushStateToLive(idx, activeSegment, mode);
          }
        }}
        onDeleteItem={(idx) => {
          setPlaylist(prev => {
            const pl = [...prev];
            pl.splice(idx, 1);
            return pl;
          });
          setEditItemIndex(null);
        }}
        onClose={() => setEditItemIndex(null)}
      />

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
