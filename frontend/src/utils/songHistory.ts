export interface SongUsageRecord {
  lastUsed: number; // timestamp ms
  count: number;
  title?: string;
}

const STORAGE_KEY = 'worship_song_history';

export const getSongHistoryMap = (): Record<string, SongUsageRecord> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error('Failed to parse song history:', e);
    return {};
  }
};

export const recordSongUsage = (songId: string | number, songTitle?: string) => {
  if (!songId) return;
  try {
    const key = String(songId).trim();
    if (!key) return;
    const history = getSongHistoryMap();
    const existing = history[key] || { count: 0, lastUsed: 0 };
    history[key] = {
      lastUsed: Date.now(),
      count: (existing.count || 0) + 1,
      title: songTitle || existing.title || ''
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to record song usage:', e);
  }
};

export const getSongUsage = (songId: string | number): SongUsageRecord | null => {
  if (!songId) return null;
  try {
    const key = String(songId).trim();
    const history = getSongHistoryMap();
    return history[key] || null;
  } catch (e) {
    return null;
  }
};

export const formatLastUsed = (timestamp?: number): string => {
  if (!timestamp) return 'Belum pernah';
  try {
    const diffMs = Date.now() - timestamp;
    if (diffMs < 0) return 'Hari ini';
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffHours < 1) return 'Baru saja';
    if (diffHours < 24) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    if (diffWeeks === 1) return '1 minggu lalu';
    if (diffWeeks < 4) return `${diffWeeks} minggu lalu`;
    if (diffMonths === 1) return '1 bulan lalu';
    if (diffMonths < 12) return `${diffMonths} bulan lalu`;

    const d = new Date(timestamp);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
};
