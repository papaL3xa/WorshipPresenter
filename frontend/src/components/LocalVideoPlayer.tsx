import { useState, useEffect } from 'react';

export const LocalVideoPlayer = ({ id, loop, autoPlay, muted }: { id: string, loop?: boolean, autoPlay?: boolean, muted?: boolean }) => {
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
      className="w-full h-full object-contain animate-fade-in" 
      controls={!muted}
      loop={loop}
      autoPlay={autoPlay}
      muted={muted}
      src={url} 
    />
  );
};
