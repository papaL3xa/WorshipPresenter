declare global {
  interface Window {
    electronAPI?: {
      callApi: (action: string, params?: Record<string, any>, payload?: any) => Promise<any>;
    };
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST';
  payload?: any;
}

// In-memory fallback jika localStorage tidak tersedia
let inMemoryLiveState: any = { displayMode: 'content', segmentIndex: 0, updatedAt: Date.now() };

/**
 * Handler Offline Lokal saat aplikasi dibuka di browser tanpa runtime Electron.
 * Sepenuhnya bebas dari ketergantungan Google Apps Script / Google Sheets.
 */
function handleBrowserOfflineApi(action: string, params: Record<string, any> = {}, payload?: any): any {
  // 1. Live State
  if (action === 'getLiveState') {
    try {
      const raw = localStorage.getItem('worship_offline_live_state');
      if (raw) return { success: true, data: JSON.parse(raw) };
    } catch (_) { }
    return { success: true, data: inMemoryLiveState };
  }

  if (action === 'setLiveState') {
    inMemoryLiveState = { ...inMemoryLiveState, ...payload, updatedAt: Date.now() };
    try {
      localStorage.setItem('worship_offline_live_state', JSON.stringify(inMemoryLiveState));
    } catch (_) { }
    return { success: true };
  }

  // 2. Playlists
  if (action === 'getPlaylists') {
    try {
      const raw = localStorage.getItem('worship_offline_playlists');
      const list = raw ? JSON.parse(raw) : [];
      return {
        success: true,
        data: list.map((pl: any) => ({
          id: pl.id,
          name: pl.name,
          date: pl.date || ''
        }))
      };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'getPlaylistItems') {
    try {
      const plId = params.id;
      const raw = localStorage.getItem('worship_offline_playlists');
      const list = raw ? JSON.parse(raw) : [];
      const pl = list.find((item: any) => item.id === plId);
      if (pl) {
        return {
          success: true,
          data: {
            playlistId: pl.id,
            name: pl.name,
            date: pl.date || '',
            items: typeof pl.items === 'string' ? JSON.parse(pl.items) : (pl.items || [])
          }
        };
      }
      return { success: true, data: { items: [] } };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'savePlaylist') {
    try {
      const raw = localStorage.getItem('worship_offline_playlists');
      let list = raw ? JSON.parse(raw) : [];
      const id = payload?.id || `pl_${Date.now()}`;
      const newPlaylist = {
        id,
        name: payload?.name || 'Untitled Playlist',
        date: payload?.date || '',
        items: payload?.items || []
      };

      const idx = list.findIndex((item: any) => item.id === id);
      if (idx >= 0) {
        list[idx] = newPlaylist;
      } else {
        list.push(newPlaylist);
      }
      localStorage.setItem('worship_offline_playlists', JSON.stringify(list));
      return { success: true, playlistId: id, status: payload?.id ? 'updated' : 'saved' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'deletePlaylist') {
    try {
      const plId = payload?.id;
      const raw = localStorage.getItem('worship_offline_playlists');
      let list = raw ? JSON.parse(raw) : [];
      list = list.filter((item: any) => item.id !== plId);
      localStorage.setItem('worship_offline_playlists', JSON.stringify(list));
      return { success: true, status: 'deleted' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // 3. Custom Songs
  if (action === 'getCustomSongs') {
    try {
      const raw = localStorage.getItem('worship_offline_custom_songs');
      return { success: true, data: raw ? JSON.parse(raw) : [] };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'saveSongItem') {
    try {
      const raw = localStorage.getItem('worship_offline_custom_songs');
      let list = raw ? JSON.parse(raw) : [];
      const s = payload || {};
      const origId = s.originalId || s.id;
      const newSong = {
        id: s.id,
        title: s.title || "Lagu Baru",
        author: s.author || "-",
        category: s.category || "Pujian",
        versionId: s.versionId || "song_LSEB",
        segmentOrder: Array.from({ length: (s.segments || []).length }, (_, i) => i),
        segments: s.segments || [],
        segmentLabels: s.segmentLabels || (s.segments || []).map((_: any, i: number) => `Slide ${i + 1}`)
      };
      const idx = list.findIndex((item: any) => item.id === origId || item.id === s.id);
      if (idx >= 0) {
        list[idx] = newSong;
      } else {
        list.push(newSong);
      }
      localStorage.setItem('worship_offline_custom_songs', JSON.stringify(list));
      return { success: true, status: 'saved', songId: s.id };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'deleteSongItem') {
    try {
      const raw = localStorage.getItem('worship_offline_custom_songs');
      let list = raw ? JSON.parse(raw) : [];
      list = list.filter((item: any) => item.id !== payload?.id);
      localStorage.setItem('worship_offline_custom_songs', JSON.stringify(list));
      return { success: true, status: 'deleted' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // 4. Global Settings & Backup
  if (action === 'getGlobalSettings') {
    try {
      const raw = localStorage.getItem('worship_offline_settings');
      return { success: true, data: raw ? JSON.parse(raw) : {} };
    } catch (_) {
      return { success: true, data: {} };
    }
  }

  if (action === 'saveGlobalSettings') {
    try {
      localStorage.setItem('worship_offline_settings', JSON.stringify(payload || {}));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'backupFullDatabase') {
    return {
      success: true,
      status: 'success',
      message: 'Database berhasil dicadangkan secara lokal di penyimpanan offline.'
    };
  }

  if (action === 'getLibraryStats') {
    return { success: true, data: { totalSongs: 500, totalBibleVerses: 31102 } };
  }

  // 6. Media Handlers
  if (action === 'listMediaFiles') {
    return { success: true, data: [] };
  }

  if (action === 'saveMediaFile') {
    return { success: true, id: payload?.id, url: payload?.dataUrl || '' };
  }

  if (action === 'deleteMediaFile') {
    return { success: true };
  }

  if (action === 'read-database-folder') {
    return { success: true, files: [] };
  }

  return { success: true, data: null };
}

/**
 * Universal callApi:
 * - Jika berjalan di Electron Desktop: Menggunakan IPC (window.electronAPI.callApi).
 * - Jika berjalan di Browser: Menggunakan penyimpanan lokal offline (localStorage/IndexedDB).
 * - 100% Offline: Tidak pernah menghubungi server eksternal atau Google Apps Script.
 */
export async function callApi(
  action: string,
  params: Record<string, any> = {},
  options: ApiOptions = { method: 'GET' }
): Promise<any> {
  // 1. Electron Desktop Environment
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.callApi === 'function') {
    return await window.electronAPI.callApi(action, params, options.payload);
  }

  // 2. Browser Local Offline Fallback
  return handleBrowserOfflineApi(action, params, options.payload);
}
