import { useState, useEffect } from 'react';
import { getAllSlideBackgrounds } from '../utils/imageStorage';

export interface BackgroundData {
  id: string;
  url: string;
  type: 'image' | 'video';
}

export function useBackgrounds() {
  const [bgCache, setBgCache] = useState<Record<string, BackgroundData>>({});

  const fetchBackgrounds = async () => {
    try {
      const bgs = await getAllSlideBackgrounds();
      const map: Record<string, BackgroundData> = {};
      bgs.forEach((bg: any) => {
        map[bg.id] = { url: bg.url, type: bg.type || 'image', id: bg.id };
      });
      setBgCache(map);
    } catch (err) {
      console.error("Failed to load backgrounds", err);
    }
  };

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const getBgUrl = (bgId: string | null | undefined): BackgroundData | null => {
    if (!bgId) return null;
    // If it's an uploaded background, it will be in the cache
    if (bgCache[bgId]) {
      return bgCache[bgId];
    }
    // If it's a preset URL or a direct URL, we can infer its type
    const isVideo = bgId.match(/\.(mp4|webm)$/i);
    return {
      id: bgId,
      url: bgId,
      type: isVideo ? 'video' : 'image'
    };
  };

  return { bgCache, refreshBackgrounds: fetchBackgrounds, getBgUrl };
}
