import React, { useState, useEffect, useRef } from 'react';
import { callApi } from '../api';
import { CONFIG } from '../config';

const CrossfadeText = ({ text, processText, isBlank, className, style }: any) => {
  const [renderList, setRenderList] = useState([{ id: Date.now(), text }]);

  useEffect(() => {
    setRenderList(prev => {
      if (prev.length > 0 && prev[prev.length - 1].text === text) return prev;
      return [...prev.slice(-1), { id: Date.now(), text }];
    });
  }, [text]);

  return (
    <div className={`grid w-full ${className}`} style={style}>
      {renderList.map((item, index) => {
        const isLatest = index === renderList.length - 1;
        return (
          <div
            key={item.id}
            className="w-full text-center leading-tight"
            style={{
              gridArea: '1 / 1',
              animation: isLatest ? (renderList.length > 1 ? 'fadeIn 0.5s ease-out forwards' : 'none') : 'fadeOut 0.5s ease-out forwards',
            }}
            onAnimationEnd={() => {
              if (!isLatest) {
                setRenderList(prev => prev.filter(p => p.id !== item.id));
              }
            }}
            dangerouslySetInnerHTML={{ __html: isBlank ? '' : processText(item.text) }}
          />
        );
      })}
    </div>
  );
};

export default function StageDisplay() {
  const [liveState, setLiveState] = useState<{
    playlistId?: string;
    currentItemId?: string;
    segmentIndex: number;
    displayMode: string;
    item?: any;
    updatedAt?: number;
  }>({
    segmentIndex: 0,
    displayMode: 'content',
  });

  const [playlistMap, setPlaylistMap] = useState<Record<string, any>>({});
  const [playlistArray, setPlaylistArray] = useState<any[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const currentPlaylistIdRef = useRef<string | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [sermonElapsed, setSermonElapsed] = useState<number>(0);
  const [isSermonRunning, setIsSermonRunning] = useState<boolean>(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sermon / Speaker timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSermonRunning) {
      timer = setInterval(() => {
        setSermonElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSermonRunning]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    const channel = new BroadcastChannel('worship_live_sync');
    channel.postMessage({ type: 'REQUEST_PLAYLIST' });
    channel.onmessage = (msg) => {
      if (msg.data.type === 'STATE_UPDATE') {
        const newState = msg.data.state;
        if (!newState) return;
        setLiveState(prevState => {
          const appliedState = { updatedAt: Date.now(), ...newState };
          if (appliedState.displayMode !== undefined && appliedState.displayMode !== prevState.displayMode) {
            lastUpdateRef.current = appliedState.updatedAt;
            return { ...prevState, ...appliedState };
          }
          if (appliedState.updatedAt >= lastUpdateRef.current) {
            lastUpdateRef.current = appliedState.updatedAt;
            return { ...prevState, ...appliedState };
          }
          return prevState;
        });
      } else if (msg.data.type === 'PLAYLIST_UPDATE') {
        setPlaylistArray(msg.data.payload);
        const newMap: Record<string, any> = {};
        msg.data.payload.forEach((item: any) => {
          newMap[item.id] = item;
        });
        setPlaylistMap(newMap);
      }
    };

    let interval: NodeJS.Timeout;
    const pollGas = async () => {
      try {
        const res = await callApi('getLiveState');
        if (res.success && res.data) {
          const gasState = res.data;

          if (gasState.playlistId && gasState.playlistId !== currentPlaylistIdRef.current) {
            currentPlaylistIdRef.current = gasState.playlistId;
            try {
              const plRes = await callApi('getPlaylistItems', { id: gasState.playlistId });
              if (plRes.success && plRes.data && plRes.data.items) {
                const newMap: Record<string, any> = {};
                plRes.data.items.forEach((item: any) => {
                  newMap[item.id] = item;
                });
                setPlaylistMap(newMap);
                setPlaylistArray(plRes.data.items);
              }
            } catch (e) {
              console.error("Gagal menarik data playlist untuk stage display", e);
            }
          }

          if (gasState.updatedAt && gasState.updatedAt > lastUpdateRef.current) {
            lastUpdateRef.current = gasState.updatedAt;
            setLiveState(prev => ({
              ...prev,
              playlistId: gasState.playlistId,
              currentItemId: gasState.currentItemId,
              segmentIndex: gasState.segmentIndex || 0,
              displayMode: gasState.displayMode || 'content',
            }));
          }
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    };

    pollGas();
    interval = setInterval(pollGas, CONFIG.POLLING_INTERVAL_MS);

    return () => {
      channel.close();
      clearInterval(interval);
    };
  }, []);

  const isBlank = liveState.displayMode === 'blank';
  let currentText = '';
  let nextText = '';
  let title = '';
  let itemType = '';

  if (liveState.item && liveState.item.segments) {
    currentText = liveState.item.segments[liveState.segmentIndex];
    nextText = liveState.item.segments[liveState.segmentIndex + 1];
    title = liveState.item.title;
    itemType = liveState.item.type || (liveState.item.book ? 'bible' : 'song');
  }
  else if (liveState.currentItemId && playlistMap[liveState.currentItemId]) {
    const pItem = playlistMap[liveState.currentItemId];
    if (pItem.segments && pItem.segments.length > liveState.segmentIndex) {
      currentText = pItem.segments[liveState.segmentIndex];
      nextText = pItem.segments[liveState.segmentIndex + 1];
      title = pItem.title;
      itemType = pItem.type || (pItem.book ? 'bible' : 'song');
    }
  }

  let isNextNewItem = false;
  let nextItemTitle = '';

  if (!nextText && liveState.currentItemId && playlistArray.length > 0) {
    const currentIndex = playlistArray.findIndex(item => item.id === liveState.currentItemId);
    if (currentIndex >= 0 && currentIndex < playlistArray.length - 1) {
      const nextItem = playlistArray[currentIndex + 1];
      isNextNewItem = true;
      nextItemTitle = nextItem.title || '';
      if (nextItem.segments && nextItem.segments.length > 0) {
        nextText = nextItem.segments[0];
      } else {
        nextText = `[ MATERI TANPA TEKS ]`;
      }
    }
  }

  nextText = nextText || '';

  const isItemResolved = (liveState.item && liveState.item.segments) || (liveState.currentItemId && playlistMap[liveState.currentItemId]);

  if (!isItemResolved) {
    currentText = liveState.currentItemId ? 'Memuat...' : 'Worship Presenter\nStage Display';
  }

  if (itemType === 'video' || itemType === 'image') {
    currentText = `[ MATERI ${itemType.toUpperCase()} SEDANG DITAMPILKAN ]`;
    nextText = '';
  }

  const processText = (raw: string) => {
    if (!raw) return '';
    let t = raw;

    // Always parse chords on Stage Display
    t = t.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]([^\[\n]*)/g, '<span class="relative inline-block mt-[1.2em]"><span class="absolute -top-[1.2em] left-0 text-yellow-400 font-bold text-[0.75em] whitespace-nowrap">$1</span>$2</span>');

    // Bilingual side-by-side layout
    if (t.includes('\n[kuning]')) {
      const parts = t.split('\n[kuning]');
      if (parts.length === 2 && parts[1].endsWith('[/kuning]')) {
        const left = parts[0].replace(/\n/g, '<br/>');
        const right = parts[1].replace('[/kuning]', '').replace(/\n/g, '<br/>');
        return `<div class="flex w-full gap-8 items-stretch"><div class="flex-1 text-left self-center">${left}</div><div class="w-[2px] bg-white/30 rounded-full my-2"></div><div class="flex-1 text-right text-yellow-300 self-center">${right}</div></div>`;
      }
    }

    t = t.replace(/\n/g, '<br/>');
    t = t.replace(/\[merah\](.*?)\[\/merah\]/gi, '<span>$1</span>');
    t = t.replace(/\[kuning\](.*?)\[\/kuning\]/gi, '<span class="text-yellow-300">$1</span>');
    t = t.replace(/\[hijau\](.*?)\[\/hijau\]/gi, '<span class="text-green-400">$1</span>');
    t = t.replace(/\[biru\](.*?)\[\/biru\]/gi, '<span class="text-blue-400">$1</span>');
    t = t.replace(/\[ungu\](.*?)\[\/ungu\]/gi, '<span>$1</span>');
    t = t.replace(/\[oranye\](.*?)\[\/oranye\]/gi, '<span>$1</span>');
    return t;
  };

  const getFontSize = (t: string, isNext: boolean) => {
    if (!t) return '4cqw';
    const charCount = t.length;
    const lines = t.split('\n').length;
    let base = 6;
    if (lines >= 8 || charCount > 350) base = 3;
    else if (lines >= 6 || charCount > 250) base = 3.5;
    else if (lines >= 5 || charCount > 180) base = 4;
    else if (lines >= 4 || charCount > 100) base = 4.5;
    else if (lines >= 3 || charCount > 60) base = 5;

    if (isNext) base = base * 0.8;
    return `${base}cqw`;
  };

  const activeItemData = liveState.item || (liveState.currentItemId ? playlistMap[liveState.currentItemId] : null);
  const currentLabel = activeItemData?.segmentLabels?.[liveState.segmentIndex] || `Slide ${liveState.segmentIndex + 1}`;
  const totalSlides = activeItemData?.segments?.length || 1;
  const currentKey = activeItemData?.key || '';
  const currentBeat = activeItemData?.beat || '';
  const nextLabel = (isNextNewItem && nextItemTitle)
    ? `Item Selanjutnya: ${nextItemTitle}`
    : (activeItemData?.segmentLabels?.[liveState.segmentIndex + 1] || 'Slide Selanjutnya');

  const timeString = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden font-sans select-none">
      {/* Header: Title, Live Status, Timer, and Clock */}
      <header className="flex justify-between items-center px-6 py-3.5 bg-zinc-950 border-b border-white/10 shrink-0 gap-4">
        {/* Left: Title & Meta */}
        <div className="flex items-center gap-3 min-w-0 max-w-[45%]">
          <span className="text-2xl shrink-0">
            {itemType === 'song' ? '🎵' : itemType === 'bible' ? '📖' : itemType === 'video' ? '🎬' : '📢'}
          </span>
          <div className="min-w-0">
            <h2 className="text-yellow-400 font-bold text-2xl truncate leading-tight">
              {isBlank ? 'Layar Utama BLANK' : (title || 'Worship Presenter')}
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mt-0.5">
              {currentKey && <span className="bg-white/10 px-2 py-0.5 rounded text-amber-300">Nada: {currentKey}</span>}
              {currentBeat && <span className="bg-white/10 px-2 py-0.5 rounded text-slate-300">Ketukan: {currentBeat}</span>}
              <span className="text-slate-500">• {currentLabel} dari {totalSlides} slide</span>
            </div>
          </div>
        </div>

        {/* Center: Live / Blank Indicator */}
        <div className="shrink-0">
          {isBlank ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-red-600/20 text-red-400 border border-red-500/40 uppercase tracking-widest shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Layar Blank
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-widest shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Tayang ke Jemaat
            </span>
          )}
        </div>

        {/* Right: Sermon Timer & Digital Clock */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Sermon / Speaker Timer */}
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Durasi Khotbah</span>
              <span className="font-mono text-xl font-bold text-amber-400 tracking-wider">
                {formatTimer(sermonElapsed)}
              </span>
            </div>
            <div className="flex flex-col gap-1 ml-1">
              <button
                onClick={() => setIsSermonRunning(!isSermonRunning)}
                className={`p-1 rounded text-[10px] font-bold ${isSermonRunning ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'}`}
                title={isSermonRunning ? 'Pause Timer' : 'Mulai Timer'}
              >
                {isSermonRunning ? '⏸' : '▶'}
              </button>
              <button
                onClick={() => { setIsSermonRunning(false); setSermonElapsed(0); }}
                className="p-1 rounded text-[10px] bg-white/10 text-slate-400 hover:bg-white/20"
                title="Reset Timer"
              >
                ↺
              </button>
            </div>
          </div>

          {/* Clock */}
          <div className="text-right">
            <div className="text-white font-mono font-black text-3xl tracking-widest leading-none">
              {timeString}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1 uppercase">
              {dateString}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area: Side-by-side Dual Cards */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden relative min-h-0 bg-black">
        {/* Left / Top: Current Slide (60%) */}
        <div className="flex-[3] flex flex-col justify-center animate-fade-in relative min-h-0 bg-zinc-950/90 rounded-2xl border-2 border-amber-400/50 p-8 shadow-2xl overflow-y-auto">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="bg-amber-400 text-black px-2.5 py-0.5 text-xs font-black rounded uppercase tracking-wider shadow-sm">
              SAAT INI
            </span>
            <span className="text-amber-300 text-xs font-bold tracking-wider uppercase opacity-90">
              {currentLabel}
            </span>
          </div>
          <CrossfadeText
            text={currentText}
            processText={processText}
            isBlank={isBlank}
            className="text-white font-bold my-auto"
            style={{
              fontSize: getFontSize(currentText, false),
              containerType: 'inline-size'
            }}
          />
        </div>

        {/* Right / Bottom: Next Slide (40%) */}
        <div className="flex-[2] flex flex-col justify-center animate-fade-in relative min-h-0 bg-zinc-900/60 rounded-2xl border border-white/10 p-6 shadow-xl opacity-90 overflow-y-auto">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="bg-white/15 text-slate-300 px-2.5 py-0.5 text-xs font-black rounded uppercase tracking-wider">
              BERIKUTNYA
            </span>
            <span className="text-slate-400 text-xs font-bold tracking-wider uppercase truncate max-w-[200px]">
              {nextLabel}
            </span>
          </div>
          <CrossfadeText
            text={nextText}
            processText={processText}
            isBlank={isBlank}
            className="text-slate-300 font-medium my-auto"
            style={{
              fontSize: getFontSize(nextText, true),
              containerType: 'inline-size'
            }}
          />
        </div>
      </div>
    </div>
  );
}
