import { useState, useEffect, useRef } from 'react';
import { callApi } from '../api';
import { CONFIG } from '../config';
import { getSlideBackground } from '../utils/imageStorage';

const LocalVideoPlayer = ({ id }: { id: string }) => {
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
      autoPlay
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
  const [logoPos, setLogoPos] = useState<'top-left'|'top-right'|'bottom-left'|'bottom-right'>( (localStorage.getItem('worship_logo_position') as any) || 'bottom-right');
  const [actualBgUrl, setActualBgUrl] = useState<string | null>(null);
  
  const [rtState, setRtState] = useState({
    text: localStorage.getItem('worship_rt_text') || '',
    position: localStorage.getItem('worship_rt_pos') || 'bottom',
    speed: Number(localStorage.getItem('worship_rt_speed') || 15),
    isVisible: false
  });

  const [playlistMap, setPlaylistMap] = useState<Record<string, any>>({});
  const lastUpdateRef = useRef<number>(0);
  const currentPlaylistIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Terima update cepat via BroadcastChannel lokal
    const channel = new BroadcastChannel('worship_live_sync');
    channel.onmessage = (msg) => {
      if (msg.data.type === 'STATE_UPDATE') {
        setLiveState(prevState => {
          // Hanya update jika timestamp tidak disediakan (berarti dari lokal) atau lebih baru
          const newState = msg.data.state;
          if (!newState.updatedAt) newState.updatedAt = Date.now(); 
          if (newState.updatedAt >= lastUpdateRef.current) {
            lastUpdateRef.current = newState.updatedAt;
            return { ...prevState, ...newState };
          }
          return prevState;
        });
      } else if (msg.data.type === 'BG_UPDATE') {
        setLiveState(prev => ({ ...prev, bgUrl: msg.data.bg }));
      } else if (msg.data.type === 'LOGO_UPDATE') {
        setLiveState(prev => ({ ...prev, logoUrl: msg.data.payload }));
        if (msg.data.position) setLogoPos(msg.data.position);
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

          // Cek apakah data dari GAS lebih baru
          if (gasState.updatedAt && gasState.updatedAt > lastUpdateRef.current) {
             lastUpdateRef.current = gasState.updatedAt;
             setLiveState(prev => {
                // Jangan timpa 'item' jika kita sudah punya map dari server,
                // agar kita bisa me-lookup liriknya.
                return {
                  ...prev,
                  playlistId: gasState.playlistId,
                  currentItemId: gasState.currentItemId,
                  segmentIndex: gasState.segmentIndex || 0,
                  displayMode: gasState.displayMode || 'content',
                };
             });
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

  if (liveState.displayMode === 'blank') {
    return <div className="w-screen h-screen bg-black overflow-hidden cursor-none"></div>;
  }

  // Cari textToDisplay
  let text = '';
  let title = '';
  let itemType = '';
  let isSlideshow = false;
  let segmentLabel = '';
  let displayLabel = '';
  let totalSegments = 1;
  
  // 1. Prioritaskan item yang datang dari BroadcastChannel (liveState.item)
  if (liveState.item && liveState.item.segments) {
    text = liveState.item.segments[liveState.segmentIndex];
    title = liveState.item.title;
    itemType = liveState.item.type;
    if (liveState.item.segmentLabels && liveState.item.segmentLabels.length > liveState.segmentIndex) {
      segmentLabel = liveState.item.segmentLabels[liveState.segmentIndex];
    }
    totalSegments = liveState.item.segments.length;
    if (liveState.item.type === 'slideshow') isSlideshow = true;
  } 
  // 2. Jika tidak ada, ambil dari dictionary hasil download server (playlistMap)
  else if (liveState.currentItemId && playlistMap[liveState.currentItemId]) {
    const pItem = playlistMap[liveState.currentItemId];
    if (pItem.segments && pItem.segments.length > liveState.segmentIndex) {
      text = pItem.segments[liveState.segmentIndex];
      title = pItem.title;
      itemType = pItem.type;
      if (pItem.segmentLabels && pItem.segmentLabels.length > liveState.segmentIndex) {
        segmentLabel = pItem.segmentLabels[liveState.segmentIndex];
      }
      totalSegments = pItem.segments.length;
      if (pItem.type === 'slideshow') isSlideshow = true;
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
    } else if (!isSlideshow) {
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

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-12 text-center transition-all duration-300 overflow-hidden cursor-none"
      style={{
        backgroundImage: actualBgUrl ? `url(${actualBgUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      {/* Watermark Logo Kanan Bawah (Disembunyikan jika tidak ada konten karena logo sudah besar di tengah) */}
      {liveState.logoUrl && (text || isSlideshow || itemType === 'video') && (
        <img 
          src={liveState.logoUrl} 
          alt="Logo" 
          className={`absolute object-contain opacity-90 drop-shadow-2xl z-50 pointer-events-none ${
            logoPos === 'top-left' ? 'top-12 left-12' :
            logoPos === 'top-right' ? 'top-12 right-12' :
            logoPos === 'bottom-left' ? 'bottom-12 left-12' :
            'bottom-12 right-12' // default bottom-right
          }`}
          style={{ maxHeight: '120px', maxWidth: '200px' }}
        />
      )}

      {/* Judul Lagu / Ayat / Pengumuman */}
      {title && !isSlideshow && itemType !== 'video' && (itemType === 'song' || itemType === 'bible' || itemType === 'announcement') && (
        <h2 
          key={`title-${title}-${liveState.segmentIndex}`}
          className={`absolute left-0 right-0 w-full px-8 md:px-64 text-center text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-yellow-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] opacity-90 tracking-wider z-20 animate-fade-in ${
            rtState.isVisible && rtState.position === 'top' ? 'top-[100px]' : 'top-16'
          }`}
          style={{
            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
          }}
        >
          {title}
        </h2>
      )}

      {/* Konten Lirik/Ayat atau Slideshow atau Video */}
      <div className={itemType === 'video' ? "absolute inset-0 z-50 bg-black flex justify-center items-center" : "absolute top-40 bottom-32 left-0 right-0 flex flex-col justify-center items-center px-16 z-10"}>
        {itemType === 'video' ? (
          (() => {
            const url = text;
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
              let embedUrl = '';
              if (url.includes('list=')) {
                const listId = url.split('list=')[1].split('&')[0];
                let videoId = '';
                if (url.includes('v=')) {
                  videoId = url.split('v=')[1].split('&')[0];
                }
                embedUrl = videoId 
                  ? `https://www.youtube.com/embed/${videoId}?list=${listId}&autoplay=0&mute=0`
                  : `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=0&mute=0`;
              } else if (url.includes('youtube.com/watch?v=')) {
                const videoId = url.split('v=')[1].split('&')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0`;
              } else if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1].split('?')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0`;
              } else if (url.includes('youtube.com/embed/')) {
                embedUrl = url.includes('?') ? url.replace('autoplay=1', 'autoplay=0') : `${url}?autoplay=0`;
              } else {
                embedUrl = url; // Fallback
              }
              
              return (
                <iframe 
                  key={embedUrl}
                  className="w-full h-full object-contain animate-fade-in" 
                  src={embedUrl} 
                  allow="encrypted-media" 
                  allowFullScreen
                ></iframe>
              );
            }
            if (url.startsWith('local_vid_')) {
              return <LocalVideoPlayer key={url} id={url} />;
            }
            return (
              <video 
                key={url}
                className="w-full h-full object-contain animate-fade-in" 
                src={url} 
                controls 
              />
            );
          })()
        ) : isSlideshow ? (
          <img 
            key={`img-${text}`}
            src={text.replace('export=view', 'export=download')} 
            alt="Slideshow" 
            className="w-full h-full object-contain animate-fade-in"
          />
        ) : text ? (
          <>
            {displayLabel && (
              <div 
                className="text-yellow-300 font-bold text-2xl md:text-3xl mb-4 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-fade-in tracking-wider uppercase"
                style={{
                  textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
                }}
              >
                {displayLabel}
              </div>
            )}
            <h1 
              key={`text-${text}`}
            className={`${fontSizeClass} font-bold text-white text-center leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-fade-in`}
            style={{
              textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
            }}
            dangerouslySetInnerHTML={{ __html: processText(text) }}
            >
            </h1>
          </>
        ) : liveState.logoUrl ? (
          <img 
            src={liveState.logoUrl} 
            alt="Logo" 
            className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 object-contain animate-fade-in opacity-80"
          />
        ) : null}
      </div>

      {/* Progress Slide di Bawah */}
      {progressText && !isSlideshow && itemType !== 'video' && (
        <div 
          className="absolute left-0 right-0 w-full text-center text-white/60 text-lg font-medium tracking-wider lowercase z-20"
          style={{ 
            bottom: rtState.isVisible && rtState.position === 'bottom' ? '90px' : '40px',
            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.9)'
          }}
        >
          {progressText}
        </div>
      )}

      {/* Running Text */}
      {rtState.isVisible && rtState.text && (
        <div 
          className={`absolute left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-y border-white/10 overflow-hidden flex items-center ${
            rtState.position === 'top' ? 'top-0' : 'bottom-0'
          }`}
          style={{ height: '60px' }}
        >
          <div 
            className="animate-marquee-seamless"
            style={{ animationDuration: `${calculatedDuration}s` }}
          >
            <div className="text-white font-bold text-2xl whitespace-nowrap">
              {rtBlockText}
            </div>
            <div className="text-white font-bold text-2xl whitespace-nowrap">
              {rtBlockText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
