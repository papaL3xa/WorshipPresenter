import { callApi } from '../api';

export const exportCustomSongsTsv = async () => {
  const res = await callApi('getCustomSongs');
  const songs = res?.data || [];
  
  if (songs.length === 0) {
    alert("Tidak ada lagu kustom untuk diekspor.");
    return;
  }
  
  // Create TSV header
  let tsv = "songId\ttitle\tauthor\tcategory\tsegment1\tsegment2\tsegment3\tsegment4\tsegment5\tsegment6\tsegment7\tsegment8\n";
  
  songs.forEach((s: any) => {
    const row = [
      s.id || '',
      s.title || '',
      s.author || '',
      s.category || 'Pujian'
    ];
    
    // Add segments
    if (s.segments && Array.isArray(s.segments)) {
      s.segments.forEach((seg: string) => {
        // Escape newlines and tabs inside the segment text
        const safeSeg = seg.replace(/\t/g, ' ').replace(/\n/g, '\\n');
        row.push(safeSeg);
      });
    }
    
    tsv += row.join('\t') + '\n';
  });
  
  downloadFile(tsv, 'CustomSongs_Backup.tsv', 'text/tab-separated-values');
};

export const exportPlaylistsTsv = async () => {
  const res = await callApi('getPlaylists');
  const playlists = res?.data || [];
  
  if (playlists.length === 0) {
    alert("Tidak ada playlist untuk diekspor.");
    return;
  }
  
  // Ambil detail items untuk setiap playlist jika belum ada (terutama untuk versi WebApp)
  for (const p of playlists) {
    if (!p.items || p.items.length === 0) {
      try {
        const itemsRes = await callApi('getPlaylistItems', { id: p.id });
        if (itemsRes?.success) {
          p.items = itemsRes.data || [];
        }
      } catch (err) {
        console.error('Failed to fetch items for playlist', p.id);
      }
    }
  }
  
  let tsv = "id\tname\titems_json\n";
  playlists.forEach((p: any) => {
    const itemsJson = JSON.stringify(p.items || []).replace(/\t/g, ' ');
    tsv += `${p.id}\t${p.name}\t${itemsJson}\n`;
  });
  
  downloadFile(tsv, 'Playlists_Backup.tsv', 'text/tab-separated-values');
};

export const importBackupTsv = async (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        if (lines.length < 2) throw new Error("File kosong atau format salah.");
        
        const header = lines[0].toLowerCase();
        
        // Detect if it's CustomSongs or Playlists
        if (header.includes('items_json')) {
          // Playlists import
          let count = 0;
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split('\t');
            if (cols.length >= 3) {
              const id = cols[0];
              const name = cols[1];
              const items = JSON.parse(cols[2] || '[]');
              await callApi('savePlaylist', {}, {
                method: 'POST',
                payload: { id, name, items }
              });
              count++;
            }
          }
          resolve(`${count} Playlist berhasil diimpor!`);
        } 
        else if (header.includes('songid') && header.includes('title')) {
          // Custom Songs import
          let count = 0;
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split('\t');
            if (cols.length >= 2) {
              const id = cols[0];
              const title = cols[1];
              const author = cols[2] || '';
              const category = cols[3] || 'Pujian';
              const segments = [];
              for(let j=4; j<cols.length; j++) {
                if(cols[j]) {
                   // unescape newlines
                   segments.push(cols[j].replace(/\\n/g, '\n'));
                }
              }
              await callApi('saveSongItem', {}, {
                method: 'POST',
                payload: { id, title, author, category, segments }
              });
              count++;
            }
          }
          resolve(`${count} Lagu Kustom berhasil diimpor!`);
        }
        else {
          throw new Error("Format TSV tidak dikenali. Pastikan Anda mengunggah file backup yang valid.");
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
