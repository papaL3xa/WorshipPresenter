/**
 * Code.gs — Backend WorshipPresenter (Google Apps Script)
 * 
 * VERSI 2.0 - Dilengkapi Fitur Auto-Create Database & Playlist Editor
 */

function doGet(e) { return handleRequest(e, "GET"); }
function doPost(e) { return handleRequest(e, "POST"); }

function handleRequest(e, method) {
  const action = e.parameter.action;
  
  // Rute publik tanpa token
  if (action !== "verifyLogin" && action !== "getLiveState") {
    // Abaikan validasi token sementara karena kita pakai PIN di frontend
    // const auth = validateAuth(e);
    // if (!auth.valid) {
    //   return respondJson({ success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } });
    // }
  }

  const routes = {
    getLiveState: getLiveState,
    setLiveState: setLiveState,
    verifyLogin: verifyLoginHandler,
    updatePins: updatePinsHandler,
    getPlaylists: getPlaylists,
    savePlaylist: savePlaylist,
    getLibraryStats: getLibraryStats,
    searchSongs: searchSongs,
    getAllSongTitles: getAllSongTitles,
    getCustomSongs: getCustomSongs,
    searchBible: searchBible,
    getPlaylistItems: getPlaylistItems,
    deletePlaylist: deletePlaylist,
    uploadImages: uploadImagesHandler,
    getDriveImages: getDriveImagesHandler,
    saveSongItem: saveSongItem
  };

  const handler = routes[action];
  if (!handler) return respondJson({ success: false, error: { code: "NOT_FOUND", message: "Aksi tidak dikenali." } });

  try {
    const result = handler(e);
    return respondJson({ success: true, data: result });
  } catch (err) {
    return respondJson({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
}

function getLibraryStats() {
  return {
    totalSongs: 472,
    totalBibleVerses: 31102
  };
}

/**
 * ==========================================
 * DATABASE INITIALIZER
 * ==========================================
 * Jalankan fungsi initDatabase() HANYA SEKALI dari editor Apps Script 
 * untuk membuat seluruh tab beserta kolom-kolomnya dan data contoh.
 */
function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const createSheet = (name, headers) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
    return sheet;
  };

  // Buat Sheet sesuai schema.md
  createSheet("Users", ["userId", "email", "name", "role", "active"]);
  const sPlaylists = createSheet("Playlists", ["playlistId", "name", "serviceDate", "status", "createdAt"]);
  const sPlaylistItems = createSheet("PlaylistItems", ["itemId", "playlistId", "order", "itemType", "refId", "customText"]);
  const sSongs = createSheet("Songs", ["songId", "title", "author", "category", "segmentOrder"]);
  const sSongSegments = createSheet("SongSegments", ["segmentId", "songId", "label", "text", "order"]);
  const sBibleVerses = createSheet("BibleVerses", ["verseId", "book", "chapter", "verse", "text"]);
  const sLiveState = createSheet("LiveState", ["playlistId", "currentItemId", "segmentIndex", "displayMode", "updatedAt"]);

  // Inisialisasi baris kosong untuk LiveState
  if (sLiveState.getLastRow() === 1) {
    sLiveState.appendRow(["", "", 0, "blank", new Date().getTime()]);
  }

  // Masukkan Data Contoh (Jika kosong)
  if (sSongs.getLastRow() === 1) {
    const songId = "song_bapakami";
    sSongs.appendRow([songId, "Bapa Kami Bersyukur (LSEB 1)", "N/A", "Pujian", JSON.stringify([0,1,2,3])]);
    sSongSegments.appendRow(["seg1", songId, "Bait 1", "Bapa kami bersyukur\nAtas kasihMu besar\nYang K'kau limpahkan ke dunia\nDan beri slamat padaku", 1]);
    sSongSegments.appendRow(["seg2", songId, "Bait 2", "Waktu siang sudah lalu\nMalam pun datanglah\nLindungilah kami Tuhan\nDari mara bahaya", 2]);
    sSongSegments.appendRow(["seg3", songId, "Chorus", "Tuhan perlindunganku\nMenara kekuatanku\nKepadaMu ku berseru\nS'lamatkanlah jiwaku", 3]);
  }

  if (sBibleVerses.getLastRow() === 1) {
    sBibleVerses.appendRow(["TB_YOH_3_16", "Yohanes", 3, 16, "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal."]);
    sBibleVerses.appendRow(["TB_YOH_3_17", "Yohanes", 3, 17, "Sebab Allah mengutus Anak-Nya ke dalam dunia bukan untuk menghakimi dunia, melainkan untuk menyelamatkannya oleh Dia."]);
  }

  return "Database berhasil diinisialisasi!";
}

/**
 * ==========================================
 * CONTROLLERS / SERVICES
 * ==========================================
 */

function savePlaylist(e) {
  const payloadStr = e.parameter.payload || (e.postData ? e.postData.contents : "{}");
  const data = JSON.parse(payloadStr); // format: { name, date, items: [...] }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sPlaylists = ss.getSheetByName("Playlists");
  const sPlaylistItems = ss.getSheetByName("PlaylistItems");
  
  let playlistId = data.id;
  
  if (playlistId) {
    // Edit existing
    const pData = sPlaylists.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < pData.length; i++) {
      if (String(pData[i][0]).trim() === String(playlistId).trim()) {
        sPlaylists.getRange(i + 1, 2).setValue(data.name);
        if (data.date) sPlaylists.getRange(i + 1, 3).setValue("'" + data.date);
        found = true;
        break;
      }
    }
    
    // Jika karena alasan tertentu ID tidak ditemukan di database, paksa buat baru
    if (!found) {
      playlistId = "pl_" + new Date().getTime();
      sPlaylists.appendRow([playlistId, data.name, "'" + data.date, "scheduled", new Date().getTime()]);
    } else {
      // Hapus items lama HANYA jika playlist ada
      const iData = sPlaylistItems.getDataRange().getValues();
      for (let i = iData.length - 1; i > 0; i--) {
        if (String(iData[i][1]).trim() === String(playlistId).trim()) {
          sPlaylistItems.deleteRow(i + 1);
        }
      }
    }
  } else {
    // Create new
    playlistId = "pl_" + new Date().getTime();
    sPlaylists.appendRow([playlistId, data.name, "'" + data.date, "scheduled", new Date().getTime()]);
  }
  
  // Insert ke PlaylistItems batch
  const items = data.items || [];
  if (items.length > 0) {
    const rows = items.map((item, index) => {
      const itemId = "it_" + new Date().getTime() + "_" + index;
      return [
        itemId, 
        playlistId, 
        index + 1, 
        item.type, 
        item.refId || "", 
        item.customText || ""
      ];
    });
    sPlaylistItems.getRange(sPlaylistItems.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  
  SpreadsheetApp.flush();
  return { playlistId: playlistId, status: data.id ? "updated" : "saved" };
}
function saveSongItem(e) {
  const payloadStr = e.parameter.payload;
  if (!payloadStr) return { status: "error", message: "Payload kosong" };
  
  const data = JSON.parse(payloadStr);
  const songId = data.id; 
  const segments = data.segments; 
  const segmentLabels = data.segmentLabels; 
  
  if (!songId || !segments) return { status: "error", message: "Data tidak valid" };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sSongs = ss.getSheetByName("Songs");
  const sSongSegments = ss.getSheetByName("SongSegments");
  
  // 1. Hapus semua segment lama
  const segData = sSongSegments.getDataRange().getValues();
  for (let i = segData.length - 1; i > 0; i--) {
    if (segData[i][1] === songId) {
      sSongSegments.deleteRow(i + 1);
    }
  }
  
  // 2. Insert segment baru
  for (let i = 0; i < segments.length; i++) {
    const segId = songId + "_s" + i;
    const label = (segmentLabels && segmentLabels[i]) ? segmentLabels[i] : ("Slide " + (i+1));
    sSongSegments.appendRow([segId, songId, label, segments[i], i+1]);
  }
  
  // 3. Update segmentOrder di Songs, atau Insert jika baru
  let found = false;
  const songData = sSongs.getDataRange().getValues();
  const orderArr = Array.from({length: segments.length}, (_, i) => i);
  for (let i = 1; i < songData.length; i++) {
    if (songData[i][0] === songId) {
      if (data.title) sSongs.getRange(i + 1, 2).setValue(data.title);
      if (data.author) sSongs.getRange(i + 1, 3).setValue(data.author);
      sSongs.getRange(i + 1, 5).setValue(JSON.stringify(orderArr));
      found = true;
      break;
    }
  }

  if (!found) {
    sSongs.appendRow([songId, data.title || "Lagu Baru", data.author || "-", "Pujian", JSON.stringify(orderArr)]);
  }
  
  SpreadsheetApp.flush();
  return { status: "saved", songId: songId };
}

function deletePlaylist(e) {
  const payloadStr = e.parameter.payload || (e.postData ? e.postData.contents : "{}");
  const data = JSON.parse(payloadStr);
  const playlistId = data.id;
  
  if (!playlistId) return { status: "error", message: "ID tidak ditemukan" };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sPlaylists = ss.getSheetByName("Playlists");
  const sPlaylistItems = ss.getSheetByName("PlaylistItems");
  
  // Hapus dari Playlists (loop dari bawah agar index aman)
  const pData = sPlaylists.getDataRange().getValues();
  for (let i = pData.length - 1; i > 0; i--) {
    if (String(pData[i][0]).trim() === String(playlistId).trim()) {
      sPlaylists.deleteRow(i + 1);
    }
  }
  
  // Hapus items dari PlaylistItems (loop dari bawah)
  const iData = sPlaylistItems.getDataRange().getValues();
  for (let i = iData.length - 1; i > 0; i--) {
    if (String(iData[i][1]).trim() === String(playlistId).trim()) {
      sPlaylistItems.deleteRow(i + 1);
    }
  }
  
  SpreadsheetApp.flush(); // Pastikan perubahan tersimpan langsung ke database
  return { status: "deleted" };
}

function getAllSongTitles(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sSongs = ss.getSheetByName("Songs");
  if (sSongs.getLastRow() <= 1) return [];

  const data = sSongs.getRange(2, 1, sSongs.getLastRow() - 1, 2).getValues();
  return data.map(row => ({
    id: row[0],
    title: row[1]
  }));
}

function getCustomSongs(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sSongs = ss.getSheetByName("Songs");
  const lastRow = sSongs.getLastRow();
  if (lastRow <= 1) return { success: true, data: [] };

  const sSongSegments = ss.getSheetByName("SongSegments");
  const segData = sSongSegments.getDataRange().getValues();

  // Get ALL songs in the database
  const customData = sSongs.getRange(2, 1, lastRow - 1, 5).getValues();
  
  let results = [];
  for (let i = 0; i < customData.length; i++) {
    let row = customData[i];
    let songId = row[0];
    
    // Find segments
    let segmentsObj = [];
    for (let j = 1; j < segData.length; j++) {
      if (segData[j][1] === songId) {
        segmentsObj.push({
          text: segData[j][3],
          order: segData[j][4]
        });
      }
    }
    segmentsObj.sort((a,b) => a.order - b.order);
    
    results.push({
      id: songId,
      title: row[1],
      author: row[2],
      category: row[3],
      segmentOrder: row[4] ? JSON.parse(row[4]) : [],
      segments: segmentsObj.map(s => s.text)
    });
  }
  return { success: true, data: results };
}

function searchSongs(e) {
  const query = (e.parameter.q || "").toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sSongs = ss.getSheetByName("Songs");
  const sSongSegments = ss.getSheetByName("SongSegments");
  
  if (sSongs.getLastRow() <= 1) return [];

  const songData = sSongs.getRange(2, 1, sSongs.getLastRow() - 1, 5).getValues();
  const segmentData = sSongSegments.getLastRow() > 1 ? sSongSegments.getRange(2, 1, sSongSegments.getLastRow() - 1, 4).getValues() : [];

  let results = [];
  const searchWords = query.split(/\s+/).filter(w => w.length > 0);
  
  for (let row of songData) {
    const sId = row[0];
    const songTitle = row[1].toString().toLowerCase();
    
    // Cari segmen untuk lagu ini
    const sortedSegs = segmentData.filter(s => s[1] === sId).sort((a,b) => a[4] - b[4]);
    const segments = sortedSegs.map(s => s[3]);
    const segmentLabels = sortedSegs.map(s => s[2]);
    const fullLyrics = segments.join(" ").toLowerCase();
    
    // Cek apakah semua kata kunci ada di judul ATAU lirik
    let matchesAll = true;
    for (let word of searchWords) {
      if (!songTitle.includes(word) && !fullLyrics.includes(word)) {
        matchesAll = false;
        break;
      }
    }
    
    if (query === "" || matchesAll) {
      results.push({
        id: sId,
        type: 'song',
        title: row[1],
        author: row[2] || "",
        segments: segments.length > 0 ? segments : ["(Tidak ada lirik)"],
        segmentLabels: segmentLabels.length > 0 ? segmentLabels : ["Slide 1"]
      });
      if (results.length >= 100) break;
    }
  }
  return results;
}

function searchBible(e) {
  const query = (e.parameter.q || "").toLowerCase().trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sBible = ss.getSheetByName("BibleVerses");
  
  if (sBible.getLastRow() <= 1) return [];
  
  const bibleData = sBible.getRange(2, 1, sBible.getLastRow() - 1, 5).getValues();
  let results = [];
  
  // Cek apakah format pencarian adalah range (misal: "kejadian 1:1-5" atau "1 yohanes 3:16-18")
  const rangeMatch = query.match(/^([a-z0-9\s-]+)\s+(\d+)[:\s]+(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const bookQuery = rangeMatch[1].trim();
    const chapter = parseInt(rangeMatch[2]);
    const startV = parseInt(rangeMatch[3]);
    const endV = parseInt(rangeMatch[4]);
    
    let found = [];
    let exactBook = "";
    let firstId = "";
    
    for (let row of bibleData) {
      if (row[1].toLowerCase() === bookQuery) {
        if (row[2] == chapter && row[3] >= startV && row[3] <= endV) {
           exactBook = row[1];
           if (!firstId) firstId = row[0]; // simpan B01_C01_V01
           found.push(row[4]);
        }
      }
    }
    
    if (found.length > 0) {
      const chapterTotalVerses = bibleData.filter(b => b[1] === exactBook && b[2] == chapter).length;
      results.push({
        id: `${firstId}-${endV}`, // ex: B01_C001_V001-5
        type: 'bible',
        title: `${exactBook} ${chapter}:${startV}-${endV}`,
        segments: found,
        chapterTotalVerses: chapterTotalVerses
      });
      return results; // Langsung kembalikan item range
    }
  }

  // Jika bukan range, lakukan pencarian normal
  const searchWords = query.split(/\s+/).filter(w => w.length > 0);
  
  for (let row of bibleData) {
    const reference = `${row[1]} ${row[2]}:${row[3]}`.toLowerCase();
    const text = row[4].toString().toLowerCase();
    
    // Cek apakah SEMUA kata kunci ada di referensi ATAU di teks ayat
    let matchesAll = true;
    for (let word of searchWords) {
      if (!reference.includes(word) && !text.includes(word)) {
        matchesAll = false;
        break;
      }
    }
    
    if (query === "" || matchesAll) {
      const chapterTotalVerses = bibleData.filter(b => b[1] === row[1] && b[2] == row[2]).length;
      results.push({
        id: row[0],
        type: 'bible',
        title: `${row[1]} ${row[2]}:${row[3]}`,
        segments: [row[4]],
        chapterTotalVerses: chapterTotalVerses
      });
      if (results.length >= 100) break;
    }
  }
  return results;
}

function getPlaylists(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sPlaylists = ss.getSheetByName("Playlists");
  if (sPlaylists.getLastRow() <= 1) return [];
  
  const data = sPlaylists.getRange(2, 1, sPlaylists.getLastRow() - 1, 5).getValues();
  let results = data.map(row => {
    let dateStr = row[2];
    if (dateStr instanceof Date) {
      dateStr = Utilities.formatDate(dateStr, Session.getScriptTimeZone(), "dd-MMM-yyyy");
    } else if (typeof dateStr === 'string' && dateStr.trim() !== '') {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd-MMM-yyyy");
        }
      } catch (err) {}
    }

    return {
      id: row[0],
      name: row[1],
      date: dateStr,
      status: row[3]
    };
  });
  
  return results.reverse(); // Terbaru di atas
}

function getPlaylistItems(e) {
  const playlistId = e.parameter.id;
  if (!playlistId) throw new Error("ID Playlist tidak disertakan");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sPlaylists = ss.getSheetByName("Playlists");
  const sItems = ss.getSheetByName("PlaylistItems");
  const sSongs = ss.getSheetByName("Songs");
  const sSegments = ss.getSheetByName("SongSegments");
  const sBible = ss.getSheetByName("BibleVerses");

  // 1. Dapatkan judul playlist
  let playlistName = "Playlist Tidak Diketahui";
  let playlistDate = "";
  const pData = sPlaylists.getRange(2, 1, Math.max(1, sPlaylists.getLastRow() - 1), 5).getValues();
  for (let r of pData) {
    if (r[0] === playlistId) {
      playlistName = r[1];
      
      // Pastikan format date adalah string YYYY-MM-DD
      let d = r[2];
      if (d instanceof Date) {
        // Karena Google Sheets mungkin sudah mengubahnya jadi Date object di zona waktu lokal
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        playlistDate = `${yyyy}-${mm}-${dd}`;
      } else {
        playlistDate = String(d).replace(/^'/, ''); // hilangkan tanda kutip jika ada
      }
      
      break;
    }
  }

  // 2. Dapatkan items
  const itemsData = sItems.getLastRow() > 1 ? sItems.getRange(2, 1, sItems.getLastRow() - 1, 6).getValues() : [];
  const pItems = itemsData.filter(row => row[1] === playlistId).sort((a,b) => a[2] - b[2]);

  // Siapkan data referensi
  const songsData = sSongs.getLastRow() > 1 ? sSongs.getRange(2, 1, sSongs.getLastRow() - 1, 5).getValues() : [];
  const segmentsData = sSegments.getLastRow() > 1 ? sSegments.getRange(2, 1, sSegments.getLastRow() - 1, 4).getValues() : [];
  const bibleData = sBible.getLastRow() > 1 ? sBible.getRange(2, 1, sBible.getLastRow() - 1, 5).getValues() : [];

  let resultItems = [];

  for (let item of pItems) {
    const iId = item[0];
    const type = item[3];
    const refId = item[4];
    const customText = item[5];

    if (type === 'announcement') {
      resultItems.push({
        id: iId,
        type: 'announcement',
        title: refId || 'Pengumuman / Teks Bebas',
        segments: [customText || '']
      });
    } else if (type === 'video') {
      resultItems.push({
        id: iId,
        type: 'video',
        title: refId || 'Video / Multimedia',
        segments: [customText || '']
      });
    } else if (type === 'song') {
      const songRow = songsData.find(s => s[0] === refId);
      if (songRow) {
        // Ambil lirik lagu
        const sortedSegs = segmentsData.filter(sg => sg[1] === refId).sort((a,b) => a[4] - b[4]);
        const segs = sortedSegs.map(sg => sg[3]);
        const labels = sortedSegs.map(sg => sg[2]);
        
        let visibleIndices = null;
        try {
          if (customText) visibleIndices = JSON.parse(customText);
        } catch(e) {}
        
        let filteredSegs = segs;
        let filteredLabels = labels;
        if (visibleIndices && Array.isArray(visibleIndices)) {
           filteredSegs = segs.filter((_, i) => visibleIndices.includes(i));
           filteredLabels = labels.filter((_, i) => visibleIndices.includes(i));
        }

        resultItems.push({
          id: iId,
          refId: refId,
          type: 'song',
          title: songRow[1],
          segments: filteredSegs.length > 0 ? filteredSegs : ['(Lirik tidak tersedia)'],
          segmentLabels: filteredLabels.length > 0 ? filteredLabels : ['Slide 1'],
          originalSegments: segs,
          originalSegmentLabels: labels,
          visibleSegments: visibleIndices || null
        });
      } else {
        resultItems.push({ id: iId, refId: refId, type: 'song', title: 'Lagu Tidak Ditemukan', segments: [''] });
      }
    } else if (type === 'bible') {
      const rangeMatch = (refId || "").match(/^(B\d+_C\d+_V\d+)-(\d+)$/);
      let segs = [];
      let chapterTotalVerses = 0;
      let finalTitle = "";
      
      if (rangeMatch) {
         const baseId = rangeMatch[1]; // B01_C001_V001
         const endVerse = parseInt(rangeMatch[2]);
         
         const firstVerseRow = bibleData.find(b => b[0] === baseId);
         if (firstVerseRow) {
            const book = firstVerseRow[1];
            const chapter = firstVerseRow[2];
            const startVerse = firstVerseRow[3];
            
            const verses = bibleData.filter(b => b[1] === book && b[2] === chapter && b[3] >= startVerse && b[3] <= endVerse);
            chapterTotalVerses = bibleData.filter(b => b[1] === book && b[2] === chapter).length;
            
            segs = verses.map(v => v[4]);
            finalTitle = `${book} ${chapter}:${startVerse}-${endVerse}`;
         }
      } else {
        const bRow = bibleData.find(b => b[0] === refId);
        if (bRow) {
          segs = [bRow[4]];
          finalTitle = `${bRow[1]} ${bRow[2]}:${bRow[3]}`;
          chapterTotalVerses = bibleData.filter(b => b[1] === bRow[1] && b[2] === bRow[2]).length;
        }
      }

      if (segs.length > 0) {
        let visibleIndices = null;
        try {
          if (customText) visibleIndices = JSON.parse(customText);
        } catch(e) {}
        
        let filteredSegs = segs;
        if (visibleIndices && Array.isArray(visibleIndices)) {
           filteredSegs = segs.filter((_, i) => visibleIndices.includes(i));
        }

        resultItems.push({
          id: iId,
          refId: refId,
          type: 'bible',
          title: finalTitle,
          segments: filteredSegs.length > 0 ? filteredSegs : ['(Teks tidak tersedia)'],
          originalSegments: segs,
          visibleSegments: visibleIndices || null,
          chapterTotalVerses: chapterTotalVerses
        });
      } else {
        resultItems.push({ id: iId, refId: refId, type: 'bible', title: 'Ayat Tidak Ditemukan', segments: [''] });
      }
    } else if (type === 'slideshow') {
      let urls = [];
      try {
        urls = JSON.parse(customText || "[]");
      } catch (e) {
        urls = [];
      }
      resultItems.push({
        id: iId,
        type: 'slideshow',
        title: 'Slideshow Gambar',
        segments: urls
      });
    }
  }

  return {
    playlistId: playlistId,
    name: playlistName,
    date: playlistDate,
    items: resultItems
  };
}

// Fungsi LiveState (sama seperti sebelumnya)
function getLiveState(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LiveState");
  if (!sheet) return {};
  const data = sheet.getRange("A2:E2").getValues()[0];
  
  // Ambil detail custom text jika refId kosong tapi customText ada di PlaylistItems
  return {
    playlistId: data[0],
    currentItemId: data[1],
    segmentIndex: data[2],
    displayMode: data[3],
    updatedAt: data[4]
  };
}

function setLiveState(e) {
  const payloadStr = e.parameter.payload || (e.postData ? e.postData.contents : "{}");
  const data = JSON.parse(payloadStr);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LiveState");
  const now = new Date().getTime();
  sheet.getRange("A2:E2").setValues([[data.playlistId || "", data.currentItemId || "", data.segmentIndex || 0, data.displayMode || "content", now]]);
  return { updated: true, timestamp: now };
}

function verifyLoginHandler(e) {
  const payloadStr = e.parameter.payload || (e.postData ? e.postData.contents : "{}");
  const data = JSON.parse(payloadStr);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sSecurity = ss.getSheetByName("Security");
  
  if (!sSecurity) {
    sSecurity = ss.insertSheet("Security");
    sSecurity.appendRow(["Role", "PIN"]);
    sSecurity.appendRow(["admin", "888888"]);
    sSecurity.appendRow(["operator", "123456"]);
    sSecurity.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  
  const secData = sSecurity.getDataRange().getValues();
  let adminPin = '888888';
  let operatorPin = '123456';
  
  for (let i = 1; i < secData.length; i++) {
    if (secData[i][0] === 'admin') adminPin = String(secData[i][1]);
    if (secData[i][0] === 'operator') operatorPin = String(secData[i][1]);
  }
  
  if (String(data.pin) === adminPin) return { role: 'admin', token: 'token_admin_' + new Date().getTime() };
  if (String(data.pin) === operatorPin) return { role: 'operator', token: 'token_op_' + new Date().getTime() };
  
  throw new Error("PIN salah.");
}

function updatePinsHandler(e) {
  const payloadStr = e.parameter.payload || (e.postData ? e.postData.contents : "{}");
  const data = JSON.parse(payloadStr);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sSecurity = ss.getSheetByName("Security");
  
  if (!sSecurity) {
    sSecurity = ss.insertSheet("Security");
    sSecurity.appendRow(["Role", "PIN"]);
    sSecurity.appendRow(["admin", "888888"]);
    sSecurity.appendRow(["operator", "123456"]);
    sSecurity.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  
  const secData = sSecurity.getDataRange().getValues();
  let currentAdminPin = '888888';
  let adminRow = -1;
  let operatorRow = -1;
  
  for (let i = 1; i < secData.length; i++) {
    if (secData[i][0] === 'admin') {
      currentAdminPin = String(secData[i][1]);
      adminRow = i + 1;
    }
    if (secData[i][0] === 'operator') {
      operatorRow = i + 1;
    }
  }
  
  if (adminRow === -1) { adminRow = sSecurity.getLastRow() + 1; sSecurity.getRange(adminRow, 1).setValue('admin'); }
  if (operatorRow === -1) { operatorRow = sSecurity.getLastRow() + 1; sSecurity.getRange(operatorRow, 1).setValue('operator'); }
  
  if (String(data.adminPin) !== currentAdminPin) {
    throw new Error("PIN Admin saat ini salah.");
  }
  
  if (data.newOperatorPin) sSecurity.getRange(operatorRow, 2).setValue(data.newOperatorPin);
  if (data.newAdminPin) sSecurity.getRange(adminRow, 2).setValue(data.newAdminPin);
  
  return { success: true };
}

function uploadImagesHandler(e) {
  const payloadStr = e.parameter.payload || (e.postData ? e.postData.contents : "{}");
  const data = JSON.parse(payloadStr);
  
  if (!data.images || !Array.isArray(data.images)) {
    throw new Error("Data gambar tidak valid.");
  }
  
  let folder;
  const folders = DriveApp.getFoldersByName("WorshipPresenter_Images");
  if (folders.hasNext()) {
    folder = folders.next();
    // Force sharing to ensure images are public
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } else {
    folder = DriveApp.createFolder("WorshipPresenter_Images");
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  const urls = [];
  for (let img of data.images) {
    // img format: { name: "slide1.jpg", mimeType: "image/jpeg", base64: "..." }
    const blob = Utilities.newBlob(Utilities.base64Decode(img.base64), img.mimeType, img.name);
    const file = folder.createFile(blob);
    // Use standard uc?id for direct image embedding
    urls.push("https://drive.google.com/uc?id=" + file.getId());
  }
  return { urls: urls };
}

function validateAuth(e) {
  const token = e.parameter.token;
  if (!token) return { valid: false };
  return { valid: true, user: "operator" };
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getDriveImagesHandler(e) {
  const folders = DriveApp.getFoldersByName("WorshipPresenter_Images");
  if (!folders.hasNext()) {
    return { images: [] };
  }
  const folder = folders.next();
  // Ensure the folder is public so old images become accessible
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const files = folder.getFiles();
  const images = [];
  while (files.hasNext()) {
    const file = files.next();
    const mime = file.getMimeType();
    if (mime.indexOf("image/") !== -1) {
      images.push({
        id: file.getId(),
        name: file.getName(),
        url: "https://drive.google.com/uc?id=" + file.getId()
      });
    }
  }
  return { images: images };
}
