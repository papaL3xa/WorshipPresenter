import React, { useEffect, useState } from 'react';
import { getLocalImage } from '../utils/imageStorage';

interface LocalImageLoaderProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  alt?: string;
}

export const LocalImageLoader: React.FC<LocalImageLoaderProps> = ({ id, className, style, onLoad, alt = '' }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let objectUrl = '';

    const loadImg = async () => {
      // Jika ID sudah berupa URL langsung (file://, data:, http) — gunakan langsung
      // Ini yang terjadi di Electron saat user memilih file dari disk
      if (id.startsWith('file://') || id.startsWith('data:') || id.startsWith('http')) {
        setSrc(id);
        onLoad?.();
        return;
      }

      // Web browser: ambil dari IndexedDB
      const data = await getLocalImage(id);
      if (data) {
        if (typeof data === 'string') {
          setSrc(data);
          onLoad?.();
        } else if (data instanceof Blob) {
          objectUrl = URL.createObjectURL(data);
          setSrc(objectUrl);
          onLoad?.();
        }
      }
    };

    loadImg();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!src) return (
    <div className={`flex items-center justify-center bg-black/20 ${className}`} style={style}>
      <span className="text-white/50 text-xs">Memuat...</span>
    </div>
  );

  return <img src={src} className={className} style={style} alt={alt} />;
};
