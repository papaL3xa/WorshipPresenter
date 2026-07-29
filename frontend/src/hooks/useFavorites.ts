import { useState, useEffect } from 'react';
import { SearchResult } from '../pages/Library';

export function useFavorites() {
  const [favorites, setFavorites] = useState<SearchResult[]>(() => {
    try {
      const saved = localStorage.getItem('worship_favorite_items');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse favorites from localStorage', e);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('worship_favorite_items', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (item: SearchResult) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id);
      if (exists) {
        return prev.filter(f => f.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const isFavorite = (id: string) => favorites.some(f => f.id === id);

  return { favorites, toggleFavorite, isFavorite };
}
