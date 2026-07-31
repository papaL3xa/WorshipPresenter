import { callApi } from '../api';

// ─── EXPORT ALL (Lagu Kustom + Playlist dalam 1 file JSON) ─────────────────
export const exportAllJson = async () => {
  const [songsRes, playlistsRes, settingsRes] = await Promise.all([
    callApi('getCustomSongs'),
    callApi('getPlaylists'),
    callApi('getGlobalSettings'),
  ]);

  const songs = songsRes?.data || [];
  const playlists = playlistsRes?.data || [];
  const settings = settingsRes?.data || null;

  // Ambil items untuk tiap playlist
  for (const p of playlists) {
    if (!p.items || p.items.length === 0) {
      try {
        const itemsRes = await callApi('getPlaylistItems', { id: p.id });
        if (itemsRes?.success) p.items = itemsRes.data?.items || [];
      } catch {
        // ignore
      }
    }
  }

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    songs,
    playlists,
    settings,
  };

  const json = JSON.stringify(backup, null, 2);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  downloadFile(json, `WorshipBackup_${dateStr}.json`, 'application/json');
};

// ─── EXPORT ONLY LAGU KUSTOM ───────────────────────────────────────────────
export const exportCustomSongsJson = async () => {
  const res = await callApi('getCustomSongs');
  const songs = res?.data || [];
  if (songs.length === 0) { alert("Tidak ada lagu kustom untuk diekspor."); return; }
  const backup = { version: 1, exportedAt: new Date().toISOString(), songs };
  downloadFile(JSON.stringify(backup, null, 2), 'CustomSongs_Backup.json', 'application/json');
};

// Alias lama untuk kompatibilitas Settings.tsx yang mungkin masih import ini
export const exportCustomSongsTsv = exportCustomSongsJson;

// ─── EXPORT ONLY PLAYLIST ─────────────────────────────────────────────────
export const exportPlaylistsJson = async () => {
  const res = await callApi('getPlaylists');
  const playlists = res?.data || [];
  if (playlists.length === 0) { alert("Tidak ada playlist untuk diekspor."); return; }
  for (const p of playlists) {
    if (!p.items || p.items.length === 0) {
      try {
        const ir = await callApi('getPlaylistItems', { id: p.id });
        if (ir?.success) p.items = ir.data?.items || [];
      } catch { /* ignore */ }
    }
  }
  const backup = { version: 1, exportedAt: new Date().toISOString(), playlists };
  downloadFile(JSON.stringify(backup, null, 2), 'Playlists_Backup.json', 'application/json');
};

// Alias lama
export const exportPlaylistsTsv = exportPlaylistsJson;

// ─── IMPORT (JSON atau TSV lama) ──────────────────────────────────────────
export const importBackupTsv = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;

        // ── JSON path ──────────────────────────────────────────────────────
        if (file.name.endsWith('.json') || text.trimStart().startsWith('{')) {
          const backup = JSON.parse(text);
          let songCount = 0, playlistCount = 0;

          if (backup.songs && Array.isArray(backup.songs)) {
            for (const s of backup.songs) {
              await callApi('saveSongItem', {}, { method: 'POST', payload: s });
              songCount++;
            }
          }
          if (backup.playlists && Array.isArray(backup.playlists)) {
            for (const p of backup.playlists) {
              await callApi('savePlaylist', {}, { method: 'POST', payload: p });
              playlistCount++;
            }
          }
          if (backup.settings) {
            await callApi('saveGlobalSettings', {}, { method: 'POST', payload: backup.settings });
          }
          
          const parts = [];
          if (songCount) parts.push(`${songCount} Lagu Kustom`);
          if (playlistCount) parts.push(`${playlistCount} Playlist`);
          if (backup.settings) parts.push(`Pengaturan Tampilan`);
          if (!parts.length) throw new Error("File JSON tidak mengandung data lagu, playlist, atau pengaturan.");
          resolve(`${parts.join(', ')} berhasil diimpor!`);
          return;
        }

        // ── TSV fallback (format lama) ─────────────────────────────────────
        const lines = text.split('\n');
        if (lines.length < 2) throw new Error("File kosong atau format salah.");
        const header = lines[0].toLowerCase();

        if (header.includes('items_json')) {
          let count = 0;
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split('\t');
            if (cols.length >= 3) {
              const id = cols[0], name = cols[1];
              const items = JSON.parse(cols[2] || '[]');
              await callApi('savePlaylist', {}, { method: 'POST', payload: { id, name, items } });
              count++;
            }
          }
          resolve(`${count} Playlist berhasil diimpor!`);
        } else if (header.includes('songid') && header.includes('title')) {
          let count = 0;
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split('\t');
            if (cols.length >= 2) {
              const id = cols[0], title = cols[1], author = cols[2] || '', category = cols[3] || 'Pujian';
              const segments: string[] = [];
              for (let j = 4; j < cols.length; j++) {
                if (cols[j]) segments.push(cols[j].replace(/\\n/g, '\n'));
              }
              await callApi('saveSongItem', {}, { method: 'POST', payload: { id, title, author, category, segments } });
              count++;
            }
          }
          resolve(`${count} Lagu Kustom berhasil diimpor!`);
        } else {
          throw new Error("Format file tidak dikenali. Harap gunakan file .json atau .tsv yang valid.");
        }
      } catch (err: any) {
        reject(err.message || "Gagal memproses file.");
      }
    };
    reader.readAsText(file);
  });
};

function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
