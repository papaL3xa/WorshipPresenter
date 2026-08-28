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

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
             } catch(e) {
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

  const timeString = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden font-sans">
      {/* Header: Clock and Title */}
      <div className="flex justify-between items-center px-8 py-4 border-b border-white/10 shrink-0">
        <h2 className="text-yellow-400 font-bold text-3xl opacity-80 max-w-[60%] truncate">
          {isBlank ? 'Layar Utama BLANK' : (title || 'Worship Presenter')}
        </h2>
        <div className="text-white font-mono font-bold text-5xl tracking-widest bg-white/10 px-6 py-2 rounded-xl">
          {timeString}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-8 gap-8 overflow-hidden relative min-h-0">
        {/* Current Slide */}
        <div className="flex-1 flex flex-col justify-center animate-fade-in relative min-h-0">
          <div className="absolute top-0 left-0 bg-yellow-400/20 text-yellow-400 px-3 py-1 text-sm font-bold rounded">SAAT INI</div>
          <CrossfadeText 
            text={currentText}
            processText={processText}
            isBlank={isBlank}
            className="text-white font-bold"
            style={{ 
              fontSize: getFontSize(currentText, false),
              containerType: 'inline-size'
            }}
          />
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-white/20 shrink-0"></div>

        {/* Next Slide */}
        <div className="flex-1 flex flex-col justify-center animate-fade-in relative opacity-60 min-h-0">
          <div className="absolute top-0 left-0 bg-white/10 text-white/50 px-3 py-1 text-sm font-bold rounded">
            {isNextNewItem ? `SELANJUTNYA: ${nextItemTitle.toUpperCase()}` : 'SELANJUTNYA'}
          </div>
          <CrossfadeText 
            text={nextText}
            processText={processText}
            isBlank={isBlank}
            className="text-slate-300 font-medium"
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
