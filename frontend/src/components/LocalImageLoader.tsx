import React, { useEffect, useState } from 'react';
import { getLocalImage, getAllSlideBackgrounds } from '../utils/imageStorage';

interface LocalImageLoaderProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  alt?: string;
}

// Global cache for Electron file:// URLs so we don't call IPC on every render
let electronMediaCache: Record<string, string> | null = null;
let electronMediaCachePromise: Promise<void> | null = null;

const getElectronMediaCache = async (): Promise<Record<string, string>> => {
  if (electronMediaCache) return electronMediaCache;
  if (!electronMediaCachePromise) {
    electronMediaCachePromise = getAllSlideBackgrounds().then(bgs => {
      electronMediaCache = {};
      bgs.forEach((bg: any) => {
        electronMediaCache![bg.id] = bg.url;
      });
    });
  }
  await electronMediaCachePromise;
  return electronMediaCache!;
};

// Call this to invalidate cache after new media is saved
export const invalidateElectronMediaCache = () => {
  electronMediaCache = null;
  electronMediaCachePromise = null;
};

export const LocalImageLoader: React.FC<LocalImageLoaderProps> = ({ id, className, style, onLoad, alt = '' }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let objectUrl = '';
    const loadImg = async () => {
      // In Electron, images are stored as physical files with file:// URLs
      // Use the media cache to get the URL directly instead of going through IndexedDB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
      if (isElectron) {
        const cache = await getElectronMediaCache();
        // Try direct match
        const url = cache[id] || cache[`local_img_${id}`];
        if (url) {
          setSrc(url);
          onLoad?.();
          return;
        }
        // If the id itself is a file:// URL or data URL, use directly
        if (id.startsWith('file://') || id.startsWith('data:')) {
          setSrc(id);
          onLoad?.();
          return;
        }
        // Not found in cache, return without blocking
        return;
      }

      // Web browser fallback: use IndexedDB
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

  if (!src) return <div className={`flex items-center justify-center bg-black/20 ${className}`} style={style}><span className="text-white/50 text-xs">Memuat...</span></div>;

  return <img src={src} className={className} style={style} alt={alt} />;
};
