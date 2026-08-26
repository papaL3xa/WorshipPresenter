import { useState, useEffect, forwardRef } from 'react';

export const LocalVideoPlayer = forwardRef<HTMLVideoElement, { id: string, loop?: boolean, autoPlay?: boolean, muted?: boolean, onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void, onPlay?: () => void, onPause?: () => void, onLoadedData?: () => void }>(({ id, loop, autoPlay, muted, onTimeUpdate, onPlay, onPause, onLoadedData }, ref) => {
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

  if (!url) return <div className="text-white text-xs md:text-sm font-semibold animate-pulse flex flex-col items-center justify-center h-full w-full bg-black/50"><div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8 mb-2"></div>Memuat...</div>;

  return (
    <video 
      ref={ref}
      className="w-full h-full object-contain animate-fade-in" 
      controls={false}
      loop={loop}
      autoPlay={autoPlay}
      muted={muted}
      onTimeUpdate={onTimeUpdate}
      onPlay={onPlay}
      onPause={onPause}
      onLoadedData={onLoadedData}
      src={url} 
    />
  );
});
