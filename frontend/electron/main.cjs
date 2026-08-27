const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Memaksa aplikasi agar mengabaikan scaling display OS (misal: 150%)
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Path to local spreadsheet/json database
const isDev = process.env.NODE_ENV === 'development';
const appName = 'WorshipPresenter';
const documentsPath = app.getPath('documents');
const appDocumentsDir = path.join(documentsPath, appName);
const mediaImagesDir = path.join(appDocumentsDir, 'Media', 'Images');
const mediaVideosDir = path.join(appDocumentsDir, 'Media', 'Videos');

// Pastikan struktur folder ada
[appDocumentsDir, mediaImagesDir, mediaVideosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

let dbPath = path.join(appDocumentsDir, 'database.json');
const oldDbPath = path.join(app.getPath('userData'), 'database.json');

// SQLite Init
let sqliteDbPath = path.join(appDocumentsDir, 'worship.sqlite');
let sqliteDb = null;
try {
  const Database = require('better-sqlite3');
  sqliteDb = new Database(sqliteDbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT,
      author TEXT,
      category TEXT,
      version_id TEXT,
      segments_json TEXT,
      searchable_text TEXT
    );
    CREATE TABLE IF NOT EXISTS bibles (
      id TEXT PRIMARY KEY,
      version_id TEXT,
      book TEXT,
      chapter INTEGER,
      verse INTEGER,
      text TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bibles_version ON bibles(version_id);
    CREATE INDEX IF NOT EXISTS idx_songs_version ON songs(version_id);
  `);
} catch (err) {
  console.error("Failed to initialize SQLite. Ensure better-sqlite3 is compiled.", err);
  const { dialog } = require('electron');
  dialog.showErrorBox("Database Error", "Failed to initialize better-sqlite3: " + err.message);
}

// Migrasi database lama jika ada dan database baru belum ada
if (!fs.existsSync(dbPath) && fs.existsSync(oldDbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
    console.log('Migrasi database lama berhasil');
  } catch (err) {
    console.error('Gagal migrasi database lama:', err);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true
  });

  if (isDev) {
    win.loadURL('http://localhost:5173/WorshipPresenter/');
    win.webContents.openDevTools();
  } else {
    // Clear any broken service workers from previous runs
    win.webContents.session.clearStorageData({ storages: ['serviceworkers'] });
    
    // In production, we build Vite with base './' so it loads locally
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

app.on('browser-window-created', (event, window) => {
  window.on('resize', () => {
    const [width] = window.getSize();
    const baseWidth = 1024;
    if (width < baseWidth) {
      window.webContents.setZoomFactor(width / baseWidth);
    } else {
      window.webContents.setZoomFactor(1);
    }
  });

  window.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      window.setFullScreen(!window.isFullScreen());
      e.preventDefault();
    }
  });
});

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://localhost/';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  const mainWin = createWindow();

  // Pastikan jendela baru (Display Window) juga mendapat preload script
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    const displays = screen.getAllDisplays();
    let displayOptions = { fullscreen: true };
    if (displays.length > 1) {
      const externalDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0) || displays[1];
      displayOptions = {
        x: externalDisplay.bounds.x,
        y: externalDisplay.bounds.y,
        fullscreen: true
      };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1280,
        height: 720,
        ...displayOptions,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false
        }
      }
    };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Local Database (replacing Google Apps Script)
function loadDb() {
  const bakPath = dbPath + '.bak';
  
  if (fs.existsSync(dbPath)) {
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.error('Database corrupted! Attempting to restore from backup...', e);
    }
  }
  
  // Jika database rusak atau hilang, coba muat dari backup
  if (fs.existsSync(bakPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
      fs.copyFileSync(bakPath, dbPath); // Auto-restore
      console.log('Successfully restored database from backup.');
      return data;
    } catch (e) {
      console.error('Backup database is also corrupted or missing.', e);
    }
  }
  
  return { customSongs: [], playlists: [] };
}

function saveDb(data) {
  const bakPath = dbPath + '.bak';
  const tmpPath = dbPath + '.tmp';
  
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 1. Tulis ke file temporary dulu agar tidak terpotong jika crash
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    
    // 2. Buat backup dari versi terakhir yang berfungsi (jika ada)
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, bakPath);
    }
    
    // 3. Timpa database utama dengan file temporary yang utuh
    fs.renameSync(tmpPath, dbPath);
  } catch (e) {
    console.error('Critical error: Failed to save database!', e);
  }
}

// In-memory live state (tidak perlu disimpan ke disk, hanya untuk sesi aktif)
let inMemoryLiveState = { displayMode: 'content', segmentIndex: 0, updatedAt: 0 };

ipcMain.handle('api-call', async (event, { action, params, payload }) => {
  const db = loadDb();

  // ----------------------------------------------------
  // SQLITE HANDLERS
  // ----------------------------------------------------
  if (action === 'init-sqlite') {
    if (!sqliteDb) return { success: false, message: 'SQLite not initialized' };
    try {
      const type = payload.type; // 'song' or 'bible'
      const versionId = payload.versionId;
      const data = payload.data;
      
      if (type === 'song') {
        const insert = sqliteDb.prepare('INSERT OR REPLACE INTO songs (id, title, author, category, version_id, segments_json, searchable_text) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertMany = sqliteDb.transaction((songs) => {
          for (const song of songs) {
            const searchableText = (song.segments ? song.segments.join(' ') : '') + ' ' + song.title;
            insert.run(song.id, song.title, song.author, song.category, versionId, JSON.stringify(song.segments || []), searchableText);
          }
        });
        insertMany(data);
      } else if (type === 'bible') {
        const count = sqliteDb.prepare('SELECT COUNT(*) as c FROM bibles WHERE version_id = ?').get(versionId);
        if (count.c === 0) {
          const insert = sqliteDb.prepare('INSERT INTO bibles (id, version_id, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?)');
          const insertMany = sqliteDb.transaction((verses) => {
            for (const v of verses) {
              const vId = `${versionId}_${v.book}_${v.chapter}_${v.verse}`;
              insert.run(vId, versionId, v.book, v.chapter, v.verse, v.text);
            }
          });
          insertMany(data);
        }
      }
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, message: err.message };
    }
  }

  if (action === 'search-sqlite-song') {
    if (!sqliteDb) return { success: false, data: [] };
    const { query, versionId, category } = payload;
    let sql = 'SELECT * FROM songs WHERE version_id = ?';
    const args = [versionId];
    if (category && category !== 'Semua') {
      sql += ' AND category = ?';
      args.push(category);
    }
    if (query) {
       sql += ' AND (searchable_text LIKE ? COLLATE NOCASE OR id LIKE ? COLLATE NOCASE)';
       args.push('%' + query + '%', '%' + query + '%');
    }
    sql += ' LIMIT 2000';
    try {
      const rows = sqliteDb.prepare(sql).all(...args);
      const formatted = rows.map(r => {
         const segs = JSON.parse(r.segments_json || '[]');
         return {
          id: r.id,
          title: r.title,
          author: r.author,
          category: r.category,
          segments: segs,
          segmentOrder: Array.from({length: segs.length}, (_, i) => i)
         };
      });
      return { success: true, data: formatted };
    } catch(err) { return { success: false, data: [] }; }
  }

  if (action === 'search-sqlite-bible') {
    if (!sqliteDb) return { success: false, data: [] };
    const { structuredQuery, versionId } = payload;
    let sql = 'SELECT * FROM bibles WHERE version_id = ?';
    let args = [versionId];

    if (structuredQuery) {
       if (structuredQuery.type === 'range') {
          sql += ' AND book LIKE ? COLLATE NOCASE AND chapter = ? AND verse >= ? AND verse <= ?';
          args.push('%' + structuredQuery.book + '%', structuredQuery.chapter, structuredQuery.startVerse, structuredQuery.endVerse);
       } else if (structuredQuery.type === 'verse') {
          sql += ' AND book LIKE ? COLLATE NOCASE AND chapter = ? AND verse = ?';
          args.push('%' + structuredQuery.book + '%', structuredQuery.chapter, structuredQuery.verse);
       } else if (structuredQuery.type === 'chapter') {
          sql += ' AND book LIKE ? COLLATE NOCASE AND chapter = ?';
          args.push('%' + structuredQuery.book + '%', structuredQuery.chapter);
       } else if (structuredQuery.type === 'book') {
          sql += ' AND book LIKE ? COLLATE NOCASE';
          args.push('%' + structuredQuery.book + '%');
       } else if (structuredQuery.type === 'free') {
          sql += ' AND text LIKE ? COLLATE NOCASE';
          args.push('%' + structuredQuery.query + '%');
       }
    }
    sql += ' LIMIT 100';
    try {
      const rows = sqliteDb.prepare(sql).all(...args);
      const formatted = rows.map(r => ({
        book: r.book,
        chapter: r.chapter,
        verse: r.verse,
        text: r.text
      }));
      return { success: true, data: formatted };
    } catch(err) { return { success: false, data: [] }; }
  }

  if (action === 'get-sqlite-song-titles') {
     if (!sqliteDb) return { success: false, data: [] };
     try {
       const rows = sqliteDb.prepare('SELECT id, title, category, author FROM songs WHERE version_id = ?').all(payload.versionId);
       return { success: true, data: rows };
     } catch (e) { return { success: false, data: [] }; }
  }
  
  if (action === 'get-sqlite-song-categories') {
     if (!sqliteDb) return { success: false, data: [] };
     try {
       const rows = sqliteDb.prepare('SELECT DISTINCT category FROM songs WHERE version_id = ? AND category IS NOT NULL').all(payload.versionId);
       return { success: true, data: rows.map(r => r.category) };
     } catch (e) { return { success: false, data: [] }; }
  }
  
  if (action === 'get-sqlite-bible-books') {
     if (!sqliteDb) return { success: false, data: [] };
     try {
       // get ordered list of books in correct biblical order, but DISTINCT only gives alphabetical if no order by.
       // actually the best is to group by book and min(id)
       const rows = sqliteDb.prepare('SELECT book FROM bibles WHERE version_id = ? GROUP BY book ORDER BY MIN(ROWID)').all(payload.versionId);
       return { success: true, data: rows.map(r => r.book) };
     } catch (e) { return { success: false, data: [] }; }
  }
  
  if (action === 'get-sqlite-bible-book-meta') {
     if (!sqliteDb) return { success: false, data: 0 };
     try {
       const row = sqliteDb.prepare('SELECT MAX(chapter) as maxC FROM bibles WHERE version_id = ? AND book = ? COLLATE NOCASE').get(payload.versionId, payload.book);
       return { success: true, data: row ? row.maxC : 0 };
     } catch (e) { return { success: false, data: 0 }; }
  }
  
  if (action === 'get-sqlite-bible-chapter-meta') {
     if (!sqliteDb) return { success: false, data: 0 };
     try {
       const row = sqliteDb.prepare('SELECT MAX(verse) as maxV FROM bibles WHERE version_id = ? AND book = ? COLLATE NOCASE AND chapter = ?').get(payload.versionId, payload.book, payload.chapter);
       return { success: true, data: row ? row.maxV : 0 };
     } catch (e) { return { success: false, data: 0 }; }
  }
  
  // ----------------------------------------------------

  if (action === 'getLiveState') {
    return { success: true, data: inMemoryLiveState };
  }

  if (action === 'read-local-file') {
    try {
      const fullPath = path.join(__dirname, '..', 'dist', payload.path);
      if (fs.existsSync(fullPath)) {
        return { success: true, data: fs.readFileSync(fullPath, 'utf8') };
      }
      return { success: false, message: 'File not found: ' + fullPath };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  if (action === 'verifyLogin') {
    return { success: true, data: { role: 'admin' } };
  }

  if (action === 'setLiveState') {
    inMemoryLiveState = { ...inMemoryLiveState, ...payload, updatedAt: Date.now() };
    return { success: true };
  }

  if (action === 'getCustomSongs') {
    return { success: true, data: db.customSongs || [] };
  }
  
  if (action === 'saveSongItem') {
    if (!db.customSongs) db.customSongs = [];
    const idx = db.customSongs.findIndex(s => s.id === payload.id);
    const newSong = {
      id: payload.id,
      title: payload.title || "Lagu Baru",
      author: payload.author || "-",
      category: payload.category || "Pujian",
      segmentOrder: Array.from({length: payload.segments.length}, (_, i) => i),
      segments: payload.segments,
      segmentLabels: payload.segmentLabels || payload.segments.map((_, i) => `Slide ${i + 1}`)
    };
    if (idx >= 0) db.customSongs[idx] = newSong;
    else db.customSongs.push(newSong);
    saveDb(db);
    return { success: true, status: 'saved', songId: payload.id };
  }
  
  if (action === 'getPlaylists') {
    return { success: true, data: db.playlists || [] };
  }
  
  if (action === 'savePlaylist') {
    if (!db.playlists) db.playlists = [];
    const idx = db.playlists.findIndex(p => p.id === payload.id);
    const newPlaylist = {
      id: payload.id || `pl_${Date.now()}`,
      name: payload.name,
      date: payload.date || '',
      items: payload.items || []
    };
    if (idx >= 0) db.playlists[idx] = newPlaylist;
    else db.playlists.push(newPlaylist);
    saveDb(db);
    return { success: true, playlistId: newPlaylist.id, status: payload.id ? 'updated' : 'saved' };
  }
  
  if (action === 'getPlaylistItems') {
    const pl = (db.playlists || []).find(p => p.id === params.id);
    return { 
      success: true, 
      data: pl ? {
        playlistId: pl.id,
        name: pl.name,
        date: pl.date || '',
        items: typeof pl.items === 'string' ? JSON.parse(pl.items) : (pl.items || [])
      } : { items: [] } 
    };
  }
  
  if (action === 'deletePlaylist') {
    if (db.playlists) {
      db.playlists = db.playlists.filter(p => p.id !== payload.id);
      saveDb(db);
    }
    return { success: true, status: 'deleted' };
  }
  
  if (action === 'getLibraryStats') {
    return { success: true, data: { totalSongs: 500, totalBibleVerses: 31102 }};
  }

  if (action === 'deleteSongItem') {
    if (!db.customSongs) db.customSongs = [];
    const idx = db.customSongs.findIndex(s => s.id === payload.id);
    if (idx >= 0) {
      db.customSongs[idx] = { id: payload.id, deleted: true };
    } else {
      db.customSongs.push({ id: payload.id, deleted: true });
    }
    saveDb(db);
    return { success: true, status: 'deleted' };
  }

  // --- IPC untuk Media (File Fisik) ---
  if (action === 'saveMediaFile') {
    try {
      const isVideo = payload.type === 'video' || payload.id.includes('_vid_');
      const targetDir = isVideo ? mediaVideosDir : mediaImagesDir;

      // Helper: detect extension from mime type or dataUrl header
      const getExtFromMime = (mime) => {
        if (!mime) return isVideo ? 'webm' : 'jpg';
        if (mime.includes('png')) return 'png';
        if (mime.includes('gif')) return 'gif';
        if (mime.includes('webp')) return 'webp';
        if (mime.includes('mp4')) return 'mp4';
        if (mime.includes('webm')) return 'webm';
        if (mime.includes('mov')) return 'mov';
        return isVideo ? 'webm' : 'jpg';
      };

      if (payload.filePath) {
        // Fast path: file selected from disk – just copy it
        const originalExt = path.extname(payload.filePath).toLowerCase();
        const filePath = path.join(targetDir, `${payload.id}${originalExt}`);
        fs.copyFileSync(payload.filePath, filePath);
        return { success: true, id: payload.id, url: `file://${filePath.replace(/\\/g, '/')}` };
      }

      if (payload.dataUrl) {
        const matches = payload.dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          // Detect extension from mime type embedded in data URL or explicit mimeType field
          const mimeFromUrl = matches[1];
          const ext = getExtFromMime(payload.mimeType || mimeFromUrl);
          const filePath = path.join(targetDir, `${payload.id}.${ext}`);
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(filePath, buffer);
          return { success: true, id: payload.id, url: `file://${filePath.replace(/\\/g, '/')}` };
        }
      }

      return { success: false, message: 'Tidak ada data valid yang dikirim' };
    } catch (err) {
      console.error('Failed to save media:', err);
      return { success: false, message: err.message };
    }
  }
  
  if (action === 'deleteMediaFile') {
    try {
      const isVideo = payload.id.includes('_vid_');
      const targetDir = isVideo ? mediaVideosDir : mediaImagesDir;
      // Cari file dengan id tersebut, karena extensinya bisa beda
      const files = fs.readdirSync(targetDir);
      const targetFile = files.find(f => f.startsWith(payload.id + '.'));
      if (targetFile) {
        fs.unlinkSync(path.join(targetDir, targetFile));
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
  
  if (action === 'listMediaFiles') {
    try {
      const results = [];
      const images = fs.existsSync(mediaImagesDir) ? fs.readdirSync(mediaImagesDir) : [];
      images.forEach(f => {
        // ID = filename without extension (e.g. "local_img_img-1234567")
        const ext = path.extname(f);
        const id = f.slice(0, f.length - ext.length);
        results.push({
          id,
          url: `file://${path.join(mediaImagesDir, f).replace(/\\/g, '/')}`,
          type: 'image'
        });
      });
      
      const videos = fs.existsSync(mediaVideosDir) ? fs.readdirSync(mediaVideosDir) : [];
      videos.forEach(f => {
        const ext = path.extname(f);
        const id = f.slice(0, f.length - ext.length);
        results.push({
          id,
          url: `file://${path.join(mediaVideosDir, f).replace(/\\/g, '/')}`,
          type: 'video'
        });
      });
      
      return { success: true, data: results };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  return { success: false, message: 'Unknown action' };
});
