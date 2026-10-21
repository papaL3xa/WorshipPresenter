import React, { useEffect, useState } from 'react';
import { getLocalImage } from '../utils/imageStorage';
import { ImageOff } from 'lucide-react';

interface LocalImageLoaderProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  alt?: string;
}

export const LocalImageLoader: React.FC<LocalImageLoaderProps> = ({ id, className, style, onLoad, alt = '' }) => {
  const [src, setSrc] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl = '';
    setHasError(false);

    const loadImg = async () => {
      // Jika ID sudah berupa URL langsung (file://, data:, http) — gunakan langsung
      if (id.startsWith('file://') || id.startsWith('data:') || id.startsWith('http')) {
        if (!isCancelled) {
          setSrc(id);
          onLoad?.();
        }
        return;
      }

      // Web browser / IndexedDB
      try {
        const data = await getLocalImage(id);
        if (isCancelled) return;

        if (data) {
          if (typeof data === 'string') {
            setSrc(data);
            onLoad?.();
          } else if (data instanceof Blob) {
            objectUrl = URL.createObjectURL(data);
            setSrc(objectUrl);
            onLoad?.();
          }
        } else {
          setHasError(true);
        }
      } catch (err) {
        console.error('Error loading image:', err);
        if (!isCancelled) setHasError(true);
      }
    };

    loadImg();

    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, onLoad]);

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-900/60 text-slate-400 p-2 border border-slate-700/50 rounded-lg ${className}`} style={style}>
        <ImageOff size={20} className="mb-1 opacity-70" />
        <span className="text-[10px]">Gambar tidak tersedia</span>
      </div>
    );
  }

  if (!src) return (
    <div className={`flex items-center justify-center bg-black/20 ${className}`} style={style}>
      <span className="text-white/50 text-xs">Memuat...</span>
    </div>
  );

  return (
    <img
      src={src}
      className={className}
      style={style}
      alt={alt}
      onError={() => setHasError(true)}
    />
  );
};
