import { useState, useEffect, useRef } from 'react';
import { callApi } from '../api';
import { CONFIG } from '../config';
import { getSlideBackground } from '../utils/imageStorage';

const LocalVideoPlayer = ({ id, loop }: { id: string, loop?: boolean }) => {
  const [url, setUrl] = useState<string>('');
  
  useEffect(() => {
    let objectUrl = '';
    const load = async () => {
      import('../utils/imageStorage').then(async (m) => {
        const blob = await m.getLocalVideo(id);
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    };
    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!url) return <div className="text-white text-2xl font-semibold animate-pulse flex flex-col items-center justify-center h-full"><div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-12 h-12 mb-4"></div>Memuat Video...</div>;

  return (
    <video 
      className="w-full h-full object-contain animate-fade-in" 
      src={url} 
      controls 
      loop={loop}
    />
  );
};

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
  
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    return () => {
      channel.close();
      clearInterval(interval);
    };
  }, []);

  // Mode blank: jangan early return, gunakan overlay agar komponen tetap render
  const isBlank = liveState.displayMode === 'blank';

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
    if (itemType === 'video') isVideoLoop = !!liveState.item.loop;
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
      if (itemType === 'video') isVideoLoop = !!pItem.loop;
      if (pItem.segmentLabels && pItem.segmentLabels.length > liveState.segmentIndex) {
        segmentLabel = pItem.segmentLabels[liveState.segmentIndex];
      }
      totalSegments = pItem.segments.length;

    }
  }

  let progressText = '';

  // Modifikasi judul Alkitab agar menampilkan ayat spesifik (bukan range)
  if (itemType === 'bible' && title) {
    const match = title.match(/(.+?)\s*:\s*(\d+)/);
    if (match) {
      const baseTitle = match[1]; // e.g., "Kejadian 1"
      const startVerse = parseInt(match[2], 10);
      title = `${baseTitle} : ${startVerse + liveState.segmentIndex}`;
      
      const realTotal = liveState.item?.chapterTotalVerses || (playlistMap[liveState.currentItemId || '']?.chapterTotalVerses) || totalSegments;
      progressText = `ayat ${startVerse + liveState.segmentIndex} dari ${realTotal}`;
    }
  } else if (itemType === 'song' && title) {
    let label = segmentLabel || `Bait ${liveState.segmentIndex + 1}`;
    if (label.startsWith('Slide ')) {
       label = label.replace('Slide ', 'Bait ');
    }
    displayLabel = label;
    
    const allLabels = liveState.item?.segmentLabels || playlistMap[liveState.currentItemId || '']?.segmentLabels || [];
    const isBait = (l: string) => l.toLowerCase().includes('bait') || l.toLowerCase().includes('verse') || l.toLowerCase().includes('slide');
    
    if (isBait(label)) {
       const totalBait = allLabels.filter(isBait).length || totalSegments;
       const currentBaitNum = allLabels.slice(0, liveState.segmentIndex + 1).filter(isBait).length || (liveState.segmentIndex + 1);
       progressText = `bait ${currentBaitNum} dari ${totalBait}`;
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
  let fontSizeClass = "text-[5vw]"; // Default untuk teks pendek
  if (text) {
    if (text.length > 250) fontSizeClass = "text-[2.5vw]";
    else if (text.length > 180) fontSizeClass = "text-[3vw]";
    else if (text.length > 120) fontSizeClass = "text-[3.5vw]";
    else if (text.length > 70) fontSizeClass = "text-[4vw]";
    else if (text.length > 40) fontSizeClass = "text-[4.5vw]";
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
      if (currentBg?.startsWith('slide_bg_')) {
        const base64 = await getSlideBackground(currentBg);
        setActualBgUrl(base64 || null);
      } else {
        setActualBgUrl(currentBg || null);
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

  return (
    <div 
      className={`fixed inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-12 text-center transition-all duration-300 overflow-hidden ${isCursorVisible ? 'cursor-default' : 'cursor-none'}`}
      style={{
        backgroundImage: actualBgUrl ? `url(${actualBgUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      {/* Multi-Logo Watermarks */}
      {logos.length > 0 && (text || itemType === 'video') && (
        <div 
          className="absolute left-0 right-0 transition-all duration-500 pointer-events-none z-40"
          style={{
            top: rtState.isVisible && rtState.position === 'top' ? `${rtState.height || 7}vw` : '0',
            bottom: rtState.isVisible && rtState.position === 'bottom' ? `${rtState.height || 7}vw` : '0'
          }}
        >
          {logos.map(logo => (
            <img 
              key={logo.id}
              src={logo.url} 
              style={{ 
                width: `${8 * logo.scale}%`,
                left: `${logo.x}%`,
                top: `${logo.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute h-auto opacity-70 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              alt="Logo" 
            />
          ))}
        </div>
      )}

      {/* Judul dan Progress Slide (Header) */}
      {itemType !== 'video' && (
        <div 
          className={`absolute left-0 right-0 w-full flex flex-col items-center z-20 animate-fade-in transition-all duration-500 ${
            rtState.isVisible && rtState.position === 'top' ? 'top-32' : 'top-12'
          }`}
        >
          {title && (itemType === 'song' || itemType === 'bible' || itemType === 'announcement') && (
            <div className="flex flex-col items-center gap-3">
              <h2 
                key={`title-${title}-${liveState.segmentIndex}`}
                className="px-8 md:px-64 text-center text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-yellow-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] opacity-90 tracking-wider mb-2"
                style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)' }}
              >
                {title}
              </h2>
              {categoryLabel && (
                <div 
                  className="bg-white/20 border border-white/30 px-3 py-1 rounded-full text-[1.2vw] font-bold text-white shadow-sm backdrop-blur-md uppercase tracking-wider"
                  style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
                >
                  {categoryLabel}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Konten Lirik/Ayat atau Slideshow atau Video */}
      <div className={itemType === 'video' ? "absolute inset-0 z-50 bg-black flex justify-center items-center" : "absolute top-40 bottom-32 left-0 right-0 flex flex-col justify-center items-center px-16 z-10"}>
        {itemType === 'video' ? (
          (() => {
            const url = text;
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
              let embedUrl = '';
              let videoId = '';
              if (url.includes('list=')) {
                const listId = url.split('list=')[1].split('&')[0];
                if (url.includes('v=')) {
                  videoId = url.split('v=')[1].split('&')[0];
                }
                embedUrl = videoId 
                  ? `https://www.youtube-nocookie.com/embed/${videoId}?list=${listId}&autoplay=0&mute=0`
                  : `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&autoplay=0&mute=0`;
              } else if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1].split('&')[0];
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=0`;
              } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=0`;
              } else if (url.includes('youtube.com/embed/') || url.includes('youtube-nocookie.com/embed/')) {
                embedUrl = url.includes('?') ? url.replace('autoplay=1', 'autoplay=0') : `${url}?autoplay=0`;
                embedUrl = embedUrl.replace('youtube.com', 'youtube-nocookie.com');
                // try to parse videoId from embed url
                videoId = embedUrl.split('embed/')[1].split('?')[0];
              } else {
                embedUrl = url; // Fallback
              }
              
              if (isVideoLoop && videoId) {
                embedUrl += `&loop=1&playlist=${videoId}`;
              }
              
              return (
                <iframe 
                  key={embedUrl}
                  className="w-full h-full object-contain animate-fade-in" 
                  src={embedUrl}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                ></iframe>
              );
            }
            if (url.startsWith('local_vid_')) {
              return <LocalVideoPlayer key={url} id={url} loop={isVideoLoop} />;
            }
            return (
              <video 
                key={url}
                className="w-full h-full object-contain animate-fade-in" 
                controls
                loop={isVideoLoop}
                src={url} 
              />
            );
          })()
        ) : itemType === 'countdown' && countdownRemaining !== null ? (
          <div className="flex flex-col items-center justify-center animate-fade-in">
            {title && (
              <div 
                className="text-white font-bold text-[4vw] mb-[2vw] drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-wider"
                style={{
                  textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
                }}
              >
                {title}
              </div>
            )}
            <div 
              className="text-white font-mono font-black text-[15vw] leading-none drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] tracking-tighter"
              style={{
                textShadow: '4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 0 8px 30px rgba(0,0,0,0.9)'
              }}
            >
              {String(Math.floor(countdownRemaining / 60)).padStart(2, '0')}:{String(countdownRemaining % 60).padStart(2, '0')}
            </div>
          </div>
        ) : text ? (
          <>
            {displayLabel && (
              <div 
                className="text-yellow-300 font-bold text-[2vw] mb-[1.5vw] drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-fade-in tracking-wider uppercase"
                style={{
                  textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
                }}
              >
                {displayLabel}
              </div>
            )}
            <h1 
              key={`text-${text}`}
            className={`${fontSizeClass} font-bold text-white text-center leading-relaxed tracking-wide drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-fade-in`}
            style={{
              textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
            }}
            dangerouslySetInnerHTML={{ __html: processText(text) }}
            >
            </h1>
          </>
        ) : logos.length > 0 ? (
          <img 
            src={logos[0].url} 
            style={{ width: `${33 * logos[0].scale}%`, maxWidth: `${400 * logos[0].scale}px` }}
            className="object-contain animate-fade-in drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" 
            alt="Logo" 
          />
        ) : null}
      </div>



      {/* Progress Text (Bait x dari y) - right above running text */}
      {progressText && (
        <div 
          className="absolute left-0 right-0 z-40 transition-all duration-500 text-center"
          style={{
            bottom: rtState.isVisible && rtState.position === 'bottom' ? `${(rtState.height || 7) + 0.5}vw` : '1vw'
          }}
        >
          <div 
            className="text-white/80 text-[1.5vw] font-medium tracking-wider lowercase inline-block"
            style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)' }}
          >
            {progressText}
          </div>
        </div>
      )}

      {/* Running Text */}
      {rtState.isVisible && rtState.text && (
        <div 
          className={`absolute left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-y border-white/10 overflow-hidden flex items-center ${
            rtState.position === 'top' ? 'top-0' : 'bottom-0'
          }`}
          style={{ height: `${rtState.height || 7}vw` }}
        >
          <div 
            className="animate-marquee-seamless"
            style={{ animationDuration: `${calculatedDuration}s` }}
          >
            <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${(rtState.height || 7) * 0.35}vw` }}>
              {rtBlockText}
            </div>
            <div className="text-white font-bold whitespace-nowrap" style={{ fontSize: `${(rtState.height || 7) * 0.35}vw` }}>
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
