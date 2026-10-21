import React, { useState, useEffect, forwardRef } from 'react';
import { getLocalVideo } from '../utils/imageStorage';
import { AlertCircle } from 'lucide-react';

interface LocalVideoPlayerProps {
  id: string;
  loop?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onLoadedData?: () => void;
  className?: string;
}

export const LocalVideoPlayer = forwardRef<HTMLVideoElement, LocalVideoPlayerProps>(({
  id,
  loop,
  autoPlay,
  muted,
  onTimeUpdate,
  onPlay,
  onPause,
  onLoadedData,
  className
}, ref) => {
  const [url, setUrl] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl = '';
    setHasError(false);

    const load = async () => {
      // Jika ID sudah berupa URL langsung (file://, http) — gunakan langsung
      if (id.startsWith('file://') || id.startsWith('http')) {
        if (!isCancelled) setUrl(id);
        return;
      }

      try {
        const blob = await getLocalVideo(id);
        if (isCancelled) return;

        if (blob) {
          if (typeof blob === 'string') {
            setUrl(blob);
          } else {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        } else {
          setHasError(true);
        }
      } catch (err) {
        console.error('Error loading video:', err);
        if (!isCancelled) setHasError(true);
      }
    };

    load();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900/80 text-rose-300 p-4 rounded-xl border border-rose-500/30">
        <AlertCircle size={28} className="mb-1 text-rose-400" />
        <span className="text-xs font-semibold text-center">Video tidak dapat dimuat</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="text-white text-xs md:text-sm font-semibold animate-pulse flex flex-col items-center justify-center h-full w-full bg-black/50">
        <div className="animate-spin border-4 border-indigo-500 border-t-transparent rounded-full w-8 h-8 mb-2"></div>
        Memuat video...
      </div>
    );
  }

  return (
    <video
      ref={ref}
      className={className || "w-full h-full object-contain animate-fade-in"}
      controls={false}
      loop={loop}
      autoPlay={autoPlay}
      muted={muted}
      onTimeUpdate={onTimeUpdate}
      onPlay={onPlay}
      onPause={onPause}
      onLoadedData={onLoadedData}
      onError={() => setHasError(true)}
      src={url}
    />
  );
});
