import { useState, useEffect, useRef } from 'react';
import { callApi } from '../api';
import { CONFIG } from '../config';
import { getSlideBackground } from '../utils/imageStorage';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import YouTube from 'react-youtube';

export default function DisplayWindow() {
  

  const [liveState, setLiveState] = useState<{
    playlistId?: string;
    currentItemId?: string;
    segmentIndex: number;
    displayMode: string;
    item?: any;
    updatedAt?: number;
    bgUrl?: string | null;
    logoUrl?: string | null;
  }>({
    segmentIndex: 0,
    displayMode: 'content',
    bgUrl: localStorage.getItem('custom_bg'),
    logoUrl: localStorage.getItem('worship_logo_b64')
  });
  
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
  const [actualBgUrl, setActualBgUrl] = useState<string | null>(null);
  const [bgType, setBgType] = useState<'image' | 'video'>('image');
  
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [scale, setScale] = useState(1);

  const [rtState, setRtState] = useState({
    text: localStorage.getItem('worship_rt_text') || '',
    position: localStorage.getItem('worship_rt_pos') || 'bottom',
    speed: Number(localStorage.getItem('worship_rt_speed') || 15),
    isVisible: localStorage.getItem('worship_rt_visible') === 'true',
    height: Number(localStorage.getItem('worship_rt_height') || 7)
  });

  const [playlistMap, setPlaylistMap] = useState<Record<string, any>>({});
  const lastUpdateRef = useRef<number>(0);
  const currentPlaylistIdRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const pendingVideoAction = useRef<'play'|'pause'|null>(null);

  useEffect(() => {
    // 1. Terima update cepat via BroadcastChannel lokal
    const channel = new BroadcastChannel('worship_live_sync');
    channel.onmessage = (msg) => {
      if (msg.data.type === 'STATE_UPDATE') {
        const newState = msg.data.state;
        if (!newState) return; // Safety guard
        setLiveState(prevState => {
          // Jangan mutasi object langsung - buat salinan
          const appliedState = { updatedAt: Date.now(), ...newState };
          // Always apply displayMode changes immediately (blank toggle must always work)
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
      } else if (msg.data.type === 'BG_UPDATE') {
        setLiveState(prev => ({ ...prev, bgUrl: msg.data.bg }));
      } else if (msg.data.type === 'LOGOS_UPDATE') {
        setLogos(msg.data.payload);
      } else if (msg.data.type === 'RUNNING_TEXT_UPDATE') {
        setRtState(msg.data.payload);
      } else if (msg.data.type === 'VIDEO_SEEK') {
        if (videoRef.current) {
          videoRef.current.currentTime = msg.data.payload.time;
        }
        if (ytPlayerRef.current) {
          ytPlayerRef.current.seekTo(msg.data.payload.time);
        }
      } else if (msg.data.type === 'VIDEO_PLAY') {
        if (videoRef.current) {
          videoRef.current.play().catch(e => console.error("DisplayWindow play error:", e));
          pendingVideoAction.current = null;
        } else {
          pendingVideoAction.current = 'play';
        }
        if (ytPlayerRef.current) ytPlayerRef.current.playVideo?.();
      } else if (msg.data.type === 'VIDEO_PAUSE') {
        if (videoRef.current) {
          videoRef.current.pause();
          pendingVideoAction.current = null;
        } else {
          pendingVideoAction.current = 'pause';
        }
        if (ytPlayerRef.current) ytPlayerRef.current.pauseVideo();
      }
    };

    // 2. Polling jarak jauh via GAS
    let interval: NodeJS.Timeout;
    const pollGas = async () => {
      try {
        const res = await callApi('getLiveState');
        if (res.success && res.data) {
          const gasState = res.data;
          
          // Cek apakah ada perubahan Playlist ID, jika ya, fetch seluruh liriknya!
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
                }
             } catch(e) {
                console.error("Gagal menarik data playlist untuk display", e);
             }
          }

          // Cek apakah data dari server lebih baru (timestamp guard mencegah override state lokal)
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

    pollGas(); // jalankan sekali saat mount
    interval = setInterval(pollGas, CONFIG.POLLING_INTERVAL_MS);

    // YouTube Progress Polling
    const ytInterval = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getPlayerState) {
        try {
          const state = ytPlayerRef.current.getPlayerState();
          if (state === 1) { // PLAYING
            const currentTime = ytPlayerRef.current.getCurrentTime();
            const duration = ytPlayerRef.current.getDuration();
            const ch = new BroadcastChannel('worship_live_sync');
            ch.postMessage({
              type: 'VIDEO_PROGRESS',
              payload: { currentTime, duration }
            });
            ch.close();
          }
        } catch(e) {}
      }
    }, 500);

    return () => {
      channel.close();
      clearInterval(interval);
      clearInterval(ytInterval);
    };
  }, []);

  // Derive isVideoMuted early for useEffect
  let isVideoMuted = false;
  if (liveState.item && liveState.item.segments && liveState.item.type === 'video') {
    isVideoMuted = !!liveState.item.muted;
  } else if (liveState.currentItemId && playlistMap[liveState.currentItemId]) {
    const pItem = playlistMap[liveState.currentItemId];
    if (pItem.type === 'video') {
      isVideoMuted = !!pItem.muted;
    }
  }

  useEffect(() => {
    if (ytPlayerRef.current) {
      if (isVideoMuted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
      }
    }
  }, [isVideoMuted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'ArrowLeft', 'ArrowUp', 'PageUp', 'b', 'B', '.'].includes(e.key)) {
        e.preventDefault();
        const ch = new BroadcastChannel('worship_live_sync');
        ch.postMessage({ type: 'REMOTE_KEYDOWN', key: e.key });
        ch.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mode blank: jangan early return, gunakan overlay agar komponen tetap render
  const isBlank = liveState.displayMode === 'blank';
  const enabledLogos = logos.filter(l => l.enabled !== false);

  // Cari textToDisplay
  let text = '';
  let title = '';
  let itemType = '';

  let segmentLabel = '';
  let displayLabel = '';
  let categoryLabel = '';
  let totalSegments = 1;
  let isVideoLoop = false;
  
  // 1. Prioritaskan item yang datang dari BroadcastChannel (liveState.item)
  if (liveState.item && liveState.item.segments) {
    text = liveState.item.segments[liveState.segmentIndex];
    title = liveState.item.title;
    itemType = liveState.item.type || (liveState.item.book ? 'bible' : 'song');
    if (itemType === 'video') {
      isVideoLoop = !!liveState.item.loop;
    }
    if (liveState.item.segmentLabels && liveState.item.segmentLabels.length > liveState.segmentIndex) {
      segmentLabel = liveState.item.segmentLabels[liveState.segmentIndex];
    }
    if (liveState.item.category && liveState.item.category !== 'Custom') {
      categoryLabel = liveState.item.category;
    }
    totalSegments = liveState.item.segments.length;

  } 
  // 2. Jika tidak ada, ambil dari dictionary hasil download server (playlistMap)
  else if (liveState.currentItemId && playlistMap[liveState.currentItemId]) {
    const pItem = playlistMap[liveState.currentItemId];
    if (pItem.segments && pItem.segments.length > liveState.segmentIndex) {
      text = pItem.segments[liveState.segmentIndex];
      title = pItem.title;
      itemType = pItem.type || (pItem.book ? 'bible' : 'song');
      if (itemType === 'video') {
        isVideoLoop = !!pItem.loop;
      }
      if (pItem.segmentLabels && pItem.segmentLabels.length > liveState.segmentIndex) {
        segmentLabel = pItem.segmentLabels[liveState.segmentIndex];
      }
      totalSegments = pItem.segments.length;

    }
  }

  let progressText = '';

  // Hapus modifikasi judul Alkitab agar judul tetap sama persis dengan yang ada di Control Panel (contoh: "Kejadian 1:1-6")
  if ((itemType === 'song' || itemType === 'bible' || itemType === 'announcement') && title) {
    // Treat as announcement if type is announcement OR title is exactly "Pengumuman"
    const isAnnouncement = itemType === 'announcement' || title.toLowerCase().includes('pengumuman');
    
    let label = segmentLabel || '';
    
    if (itemType === 'bible' && !label) {
      const match = title.match(/(.+?)\s*:\s*(\d+)/);
      if (match) {
        const startVerse = parseInt(match[2], 10);
        label = `Ayat ${startVerse + liveState.segmentIndex}`;
      } else {
        label = `Ayat ${liveState.segmentIndex + 1}`;
      }
    }
    
    if (!isAnnouncement && itemType === 'song' && label.startsWith('Slide ')) {
       label = label.replace('Slide ', 'Bait ');
    }
    displayLabel = label;
    
    if (!isAnnouncement) {
      const allLabels = liveState.item?.segmentLabels || playlistMap[liveState.currentItemId || '']?.segmentLabels || [];
      const isBait = (l: string) => l.toLowerCase().includes('bait') || l.toLowerCase().includes('verse') || l.toLowerCase().includes('slide');
      
      if (isBait(label)) {
         const totalBait = allLabels.filter(isBait).length || totalSegments;
         const currentBaitNum = allLabels.slice(0, liveState.segmentIndex + 1).filter(isBait).length || (liveState.segmentIndex + 1);
         progressText = `bait ${currentBaitNum} dari ${totalBait}`;
      } else {
         progressText = ''; 
      }
    } else {
      progressText = '';
    }
  }

  // 3. Jika belum dapat juga, tampilkan loading/not found
  const isItemResolved = (liveState.item && liveState.item.segments) || (liveState.currentItemId && playlistMap[liveState.currentItemId]);
  
  if (!isItemResolved) {
    if (liveState.currentItemId) {
      text = 'Memuat Lirik...';
    } else {
      text = 'Selamat Datang';
    }
  }

  // Hitung ukuran font dinamis berdasarkan panjang teks
  let fontSizeClass = "text-[96px]"; // Default untuk teks pendek
  if (text) {
    if (text.length > 250) fontSizeClass = "text-[48px]";
    else if (text.length > 180) fontSizeClass = "text-[58px]";
    else if (text.length > 120) fontSizeClass = "text-[67px]";
    else if (text.length > 70) fontSizeClass = "text-[77px]";
    else if (text.length > 40) fontSizeClass = "text-[86px]";
  }

  // Hitung durasi animasi yang proporsional dengan panjang teks agar kecepatan stabil
  const rtSeparator = '\u00A0\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0\u00A0\u00A0'; // 4 spasi + 1 pipe + 5 spasi = 10 karakter
  
  // Ubah baris baru (Enter) menjadi pemisah (separator) agar bisa multi pengumuman
  const formattedRtText = rtState.text 
    ? rtState.text.split('\n').filter(t => t.trim() !== '').join(rtSeparator) 
    : '';

  const rtBlockText = formattedRtText ? Array(15).fill(formattedRtText).join(rtSeparator) + rtSeparator : '';
  const rtCharCount = rtBlockText.length;
  // rtState.speed (5-40s) adalah patokan waktu untuk melewati ~100 karakter (kira-kira 1 lebar layar)
  const calculatedDuration = (rtCharCount / 100) * rtState.speed;

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

  const itemBg = liveState.item?.segmentBackgrounds?.[liveState.segmentIndex] 
    || playlistMap[liveState.currentItemId || '']?.segmentBackgrounds?.[liveState.segmentIndex];

  useEffect(() => {
    const fetchBg = async () => {
      const currentBg = itemBg || liveState.bgUrl;
      if (currentBg?.startsWith('slide_bg_vid_')) {
        const blob = await getSlideBackground(currentBg);
        if (blob instanceof Blob) {
          setActualBgUrl(URL.createObjectURL(blob));
          setBgType('video');
        } else {
          setActualBgUrl(null);
          setBgType('image');
        }
      } else if (currentBg?.startsWith('slide_bg_')) {
        const base64 = await getSlideBackground(currentBg);
        setActualBgUrl(base64 as string | null);
        setBgType('image');
      } else {
        setActualBgUrl(currentBg || null);
        setBgType(currentBg?.match(/\.(mp4|webm)$/i) ? 'video' : 'image');
      }
    };
    fetchBg();
  }, [itemBg, liveState.bgUrl]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (itemType === 'countdown') {
      const durationSec = parseInt(text || '0');
      const startTimestamp = liveState.updatedAt || Date.now();
      
      const tick = () => {
        const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
        const remaining = Math.max(0, durationSec - elapsedSec);
        setCountdownRemaining(remaining);
      };
      
      tick();
      interval = setInterval(tick, 1000);
    } else {
      setCountdownRemaining(null);
    }
    
    return () => clearInterval(interval);
  }, [itemType, text, liveState.updatedAt]);

  useEffect(() => {
    const handleMouseMove = () => {
      setIsCursorVisible(true);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => {
        setIsCursorVisible(false);
      }, 2000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    // Initial hide
    cursorTimeoutRef.current = setTimeout(() => setIsCursorVisible(false), 2000);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const targetRatio = 16 / 9;
      const windowRatio = windowWidth / windowHeight;

      if (windowRatio > targetRatio) {
        setScale(windowHeight / 1080);
      } else {
        setScale(windowWidth / 1920);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black overflow-hidden ${isCursorVisible ? 'cursor-default' : 'cursor-none'}`}>
      
      {/* Background that fills the entire viewport */}
      <div 
        className="absolute inset-0 z-0 bg-gray-900"
        style={bgType === 'image' ? {
          backgroundImage: actualBgUrl ? `url(${actualBgUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : undefined}
      >
        {bgType === 'video' && actualBgUrl && (
          <video 
            src={actualBgUrl} 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        <div className="absolute inset-0 bg-black/40 z-0"></div>
      </div>

      {/* Container utama yang mengisi seluruh area aman (di luar running text) */}
      <div 
        className="absolute left-0 right-0 z-10 flex flex-col items-center justify-center pointer-events-none transition-all duration-500"
        style={{ 
          containerType: 'inline-size',
          top: rtState.isVisible && rtState.position === 'top' ? `${((rtState.height || 7) / 56.25) * 100}%` : '0',
          bottom: rtState.isVisible && rtState.position === 'bottom' ? `${((rtState.height || 7) / 56.25) * 100}%` : '0'
        }}
      >
      {enabledLogos.length > 0 && (text || itemType === 'video') && (
        <div 
          className="absolute inset-0 pointer-events-none z-[60]"
        >
          {enabledLogos.map(logo => (
            <img 
              key={logo.id}
              src={logo.url} 
              style={{ 
                width: `${8 * logo.scale}%`,
                ...(logo.x < 50 ? { left: `${logo.x}%` } : { right: `${100 - logo.x}%` }),
                ...(logo.y < 50 ? { top: `${logo.y}%` } : { bottom: `${100 - logo.y}%` }),
              }}
              className="absolute h-auto opacity-70 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              alt="Logo" 
            />
          ))}
        </div>
      )}

      {/* Judul (Header) */}
      {liveState.displayMode === 'content' && (
        <>
          {itemType !== 'video' && title && (itemType === 'song' || itemType === 'bible' || itemType === 'announcement') && (
            <h2 
              key={`title-${title}-${liveState.segmentIndex}`}
              className="absolute left-0 right-0 w-full px-4 text-center font-heading font-bold text-yellow-300 opacity-90 tracking-wider z-20 transition-all duration-500"
              style={{
                top: '6%',
                fontSize: '1.5cqw',
                textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
              }}
            >
              {title}
            </h2>
          )}

      {/* Konten Lirik/Ayat atau Slideshow atau Video */}
      {itemType === 'video' ? (
        <div className="absolute inset-0 z-50 bg-black flex justify-center items-center pointer-events-auto">
          {(() => {
            const url = text;
            let videoId = '';
            let embedUrl = '';
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
              if (url.includes('list=')) {
                const listId = url.split('list=')[1].split('&')[0];
                if (url.includes('v=')) {
                  videoId = url.split('v=')[1].split('&')[0];
                }
                embedUrl = videoId 
                  ? `https://www.youtube-nocookie.com/embed/${videoId}?list=${listId}&autoplay=0`
                  : `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&autoplay=0`;
              } else if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1].split('&')[0];
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0`;
              } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0`;
              } else if (url.includes('youtube.com/embed/') || url.includes('youtube-nocookie.com/embed/')) {
                embedUrl = url.includes('?') ? url.replace('autoplay=1', 'autoplay=0') : `${url}?autoplay=0`;
                embedUrl = embedUrl.replace('youtube.com', 'youtube-nocookie.com');
                videoId = embedUrl.split('embed/')[1].split('?')[0];
              } else {
                embedUrl = url; // Fallback
              }
              
              if (videoId) {
                const opts = {
                  height: '100%',
                  width: '100%',
                  playerVars: {
                    autoplay: 0,
                    mute: isVideoMuted ? 1 : 0,
                    controls: 0,
                    disablekb: 1,
                    enablejsapi: 1,
                    loop: isVideoLoop ? 1 : 0,
                    playlist: isVideoLoop ? videoId : undefined,
                  }
                };
                return (
                  <YouTube
                    videoId={videoId}
                    opts={opts}
                    className="w-full h-full object-contain animate-fade-in"
                    onReady={(e: any) => {
                      ytPlayerRef.current = e.target;
                    }}
                    onStateChange={(e: any) => {
                      const ch = new BroadcastChannel('worship_live_sync');
                      if (e.data === 2) {
                        ch.postMessage({ type: 'VIDEO_STATE', payload: 'pause' });
                      } else if (e.data === 1) {
                        ch.postMessage({ type: 'VIDEO_STATE', payload: 'play' });
                      }
                      ch.close();
                    }}
                  />
                );
              }
              
              return (
                <iframe 
                  key={embedUrl}
                  className="w-full h-full object-contain animate-fade-in pointer-events-auto" 
                  src={embedUrl}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                ></iframe>
              );
            }
            const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
              const vid = e.currentTarget;
              const channel = new BroadcastChannel('worship_live_sync');
              channel.postMessage({
                type: 'VIDEO_PROGRESS',
                payload: {
                  currentTime: vid.currentTime,
                  duration: vid.duration
                }
              });
              channel.close();
            };

            const handlePlay = () => {
              const ch = new BroadcastChannel('worship_live_sync');
              ch.postMessage({ type: 'VIDEO_STATE', payload: 'play' });
              ch.close();
            };
            const handlePause = () => {
              const ch = new BroadcastChannel('worship_live_sync');
              ch.postMessage({ type: 'VIDEO_STATE', payload: 'pause' });
              ch.close();
            };

            if (url.startsWith('local_vid_')) {
              return <div className="w-full h-full pointer-events-auto">
                <LocalVideoPlayer 
                  ref={videoRef} 
                  key={url} 
                  id={url} 
                  loop={isVideoLoop} 
                  autoPlay={false} 
                  muted={isVideoMuted} 
                  onTimeUpdate={handleTimeUpdate} 
                  onPlay={handlePlay} 
                  onPause={handlePause} 
                  onLoadedData={() => {
                    if (pendingVideoAction.current === 'play' && videoRef.current) {
                      videoRef.current.play().catch(e => console.error("Play error after load:", e));
                    } else if (pendingVideoAction.current === 'pause' && videoRef.current) {
                      videoRef.current.pause();
                    }
                    pendingVideoAction.current = null;
                  }}
                />
              </div>;
            }
            return (
              <video 
                ref={videoRef}
                key={url}
                className="w-full h-full object-contain animate-fade-in pointer-events-auto" 
                src={url} 
                autoPlay={false}
                loop={isVideoLoop}
                muted={isVideoMuted}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
              />
            );
          })()}
        </div>
      ) : (
        <div className="absolute top-[18%] bottom-[12%] left-0 right-0 z-10 flex flex-col items-center justify-center w-full px-[8%]">
          {itemType === 'countdown' && countdownRemaining !== null ? (
            <div className="text-white text-center font-bold tracking-widest leading-none drop-shadow-xl w-full font-mono animate-fade-in" 
                 style={{ textShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.2)', fontSize: '18cqw' }}>
              {String(Math.floor(countdownRemaining / 60)).padStart(2, '0')}:{String(countdownRemaining % 60).padStart(2, '0')}
            </div>
          ) : text ? (
            <>
              <div 
                key={`text-${text}`}
                className="text-white text-center font-bold whitespace-pre-wrap leading-relaxed drop-shadow-xl w-full animate-fade-in" 
                style={{ 
                  textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 0 4px 10px rgba(0,0,0,0.8)', 
                  fontSize: (() => {
                    const t = text || '';
                    const charCount = t.length;
                    const visualLines = t.split('\n').reduce((acc: number, line: string) => acc + Math.ceil((line.length || 1) / 32), 0);
                    
                    if (visualLines >= 8 || charCount > 350) return '4cqw';
                    if (visualLines >= 6 || charCount > 250) return '4.5cqw';
                    if (visualLines >= 5 || charCount > 180) return '5cqw';
                    if (visualLines >= 4 || charCount > 120) return '5.5cqw';
                    if (visualLines >= 3 || charCount > 70) return '6.5cqw';
                    if (charCount > 40) return '7.5cqw';
                    return '8.5cqw';
                  })(),
                  lineHeight: '1.4'
                }}
                dangerouslySetInnerHTML={{ __html: processText(text) }}
              />
              {/* Bait Label di bawah isi */}
              <div 
                className="text-yellow-300 font-bold mt-[1.5cqw] tracking-widest uppercase animate-fade-in opacity-80"
                style={{
                  fontSize: '1.5cqw',
                  textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 10px rgba(0,0,0,0.9)',
                  minHeight: '2cqw'
                }}
              >
                {displayLabel || (itemType === 'song' ? '•' : '')}
              </div>
            </>
          ) : enabledLogos.length > 0 ? (
            <img 
              src={enabledLogos[0].url} 
              style={{ width: `${33 * enabledLogos[0].scale}%`, maxWidth: `${400 * enabledLogos[0].scale}px` }}
              className="object-contain animate-fade-in drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" 
              alt="Logo" 
            />
          ) : null}
        </div>
      )}

        </>
      )}

      </div>

      {/* Running Text */}
      {rtState.isVisible && rtState.text && (
        <div 
          className={`absolute left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-y border-white/10 overflow-hidden flex items-center ${
            rtState.position === 'top' ? 'top-0' : 'bottom-0'
          }`}
          style={{ height: `${((rtState.height || 7) / 56.25) * 100}%` }}
        >
          <div 
            className="animate-marquee-seamless shrink-0"
            style={{ animationDuration: `${calculatedDuration}s` }}
          >
            <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${((rtState.height || 7) / 56.25 * 100) * 0.35}cqw` }}>
              {rtBlockText}
            </div>
            <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${((rtState.height || 7) / 56.25 * 100) * 0.35}cqw` }}>
              {rtBlockText}
            </div>
          </div>
        </div>
      )}

      {/* Blank Mode Overlay - menutupi semua konten tanpa unmount komponen */}
      {isBlank && (
        <div className="absolute inset-0 bg-black z-[999] cursor-none flex items-center justify-center overflow-hidden">
          <img 
            src={import.meta.env.BASE_URL + "blank_logo.png"} 
            alt="Blank Logo" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
