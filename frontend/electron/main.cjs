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
const mediaBackgroundsDir = path.join(appDocumentsDir, 'Media', 'Backgrounds');
const databasesDir = path.join(appDocumentsDir, 'Databases');
const playlistsDir = path.join(appDocumentsDir, 'Playlists');

// Pastikan struktur folder ada
[appDocumentsDir, mediaImagesDir, mediaVideosDir, mediaBackgroundsDir, databasesDir, playlistsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

let dbPath = path.join(appDocumentsDir, 'database.json');
const oldDbPath = path.join(app.getPath('userData'), 'database.json');

// Migrasi database lama jika ada dan database baru belum ada
if (!fs.existsSync(dbPath) && fs.existsSync(oldDbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
    console.log('Migrasi database lama berhasil');
  } catch (err) {
    console.error('Gagal migrasi database lama:', err);
  }
}

// Migrasi Playlists lama dari database.json ke folder fisik Playlists
if (fs.existsSync(dbPath)) {
  try {
    const rawDb = fs.readFileSync(dbPath, 'utf8');
    const dbObj = JSON.parse(rawDb);
    if (dbObj.playlists && Array.isArray(dbObj.playlists)) {
      console.log('Migrating old playlists to physical folder...');
      dbObj.playlists.forEach(pl => {
        if (pl.id) {
          const safeName = (pl.name || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
          const filename = `${safeName}_${pl.id}.json`;
          fs.writeFileSync(path.join(playlistsDir, filename), JSON.stringify(pl, null, 2), 'utf8');
        }
      });
      // Hapus playlists dari database.json agar tidak dimigrasi ulang
      delete dbObj.playlists;
      fs.writeFileSync(dbPath, JSON.stringify(dbObj, null, 2), 'utf8');
      console.log('Playlist migration complete.');
    }
  } catch (err) {
    console.error('Failed to migrate playlists:', err);
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
  
  return { customSongs: [] };
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

ipcMain.handle('api-call', async (event, args) => {
  console.log("api-call arguments:", Object.keys(args || {}));
  const { action, params, payload } = args || {};
  if (!action) return { success: false, message: 'Action is required' };
  const db = loadDb();

  // ----------------------------------------------------
  // TSV DATABASE HANDLERS
  // ----------------------------------------------------
  if (action === 'read-database-folder') {
    try {
      const files = fs.readdirSync(databasesDir);
      const tsvFiles = files.filter(f => f.toLowerCase().endsWith('.tsv'));
      return { success: true, files: tsvFiles };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  if (action === 'read-tsv-file') {
    try {
      const filePath = path.join(databasesDir, payload.filename);
      if (!fs.existsSync(filePath)) {
        return { success: false, message: 'File not found' };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      return { success: true, content };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // ----------------------------------------------------
  // JSON DATABASE HANDLERS (Playlists & Custom Songs)
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
    try {
      const files = fs.readdirSync(playlistsDir).filter(f => f.endsWith('.json'));
      const playlists = [];
      for (const f of files) {
        try {
          const content = fs.readFileSync(path.join(playlistsDir, f), 'utf8');
          const pl = JSON.parse(content);
          playlists.push({
            id: pl.id,
            name: pl.name,
            date: pl.date || ''
            // do not send items for list view for performance
          });
        } catch (err) {
          console.error(`Gagal membaca playlist ${f}`, err);
        }
      }
      return { success: true, data: playlists };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  
  if (action === 'savePlaylist') {
    try {
      const id = payload.id || `pl_${Date.now()}`;
      const newPlaylist = {
        id,
        name: payload.name || 'Untitled Playlist',
        date: payload.date || '',
        items: payload.items || []
      };
      
      const safeName = (payload.name || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
      const filename = `${safeName}_${id}.json`;
      
      // If updating, delete the old file if the name changed
      if (payload.id) {
         const oldFiles = fs.readdirSync(playlistsDir).filter(f => f.endsWith(`_${payload.id}.json`));
         oldFiles.forEach(f => {
            if (f !== filename) fs.unlinkSync(path.join(playlistsDir, f));
         });
      }
      
      fs.writeFileSync(path.join(playlistsDir, filename), JSON.stringify(newPlaylist, null, 2), 'utf8');
      
      return { success: true, playlistId: id, status: payload.id ? 'updated' : 'saved' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  
  if (action === 'getPlaylistItems') {
    try {
      const plId = params.id;
      const files = fs.readdirSync(playlistsDir).filter(f => f.endsWith(`_${plId}.json`));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(playlistsDir, files[0]), 'utf8');
        const pl = JSON.parse(content);
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
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  
  if (action === 'deletePlaylist') {
    try {
      const plId = payload.id;
      const files = fs.readdirSync(playlistsDir).filter(f => f.endsWith(`_${plId}.json`));
      files.forEach(f => fs.unlinkSync(path.join(playlistsDir, f)));
      return { success: true, status: 'deleted' };
    } catch (e) {
      return { success: false, message: e.message };
    }
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
      if (!payload || typeof payload.id !== 'string') {
        console.error('Invalid payload in saveMediaFile:', payload);
        return { success: false, message: 'Payload atau ID tidak valid' };
      }
      
      const isVideo = payload.type === 'video' || payload.type === 'background-video' || payload.id.includes('_vid_');
      const isBackground = payload.type === 'background' || payload.type === 'background-video';
      
      let targetDir = mediaImagesDir;
      if (isVideo) targetDir = mediaVideosDir;
      if (isBackground) targetDir = mediaBackgroundsDir;

      // Helper: detect extension from mime type or dataUrl header
      const getExtFromMime = (mime) => {
        if (!mime || typeof mime !== 'string') return isVideo ? 'webm' : 'jpg';
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
        const formattedPath = filePath.replace(/\\/g, '/');
        const fileUrl = formattedPath.startsWith('/') ? `file://${formattedPath}` : `file:///${formattedPath}`;
        return { success: true, id: payload.id, url: fileUrl };
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
          const formattedPath = filePath.replace(/\\/g, '/');
          const fileUrl = formattedPath.startsWith('/') ? `file://${formattedPath}` : `file:///${formattedPath}`;
          return { success: true, id: payload.id, url: fileUrl };
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
      if (!payload || typeof payload.id !== 'string') {
        return { success: false, message: 'Invalid payload in deleteMediaFile' };
      }
      
      const isVideo = payload.type === 'video' || payload.type === 'background-video' || payload.id.includes('_vid_');
      const isBackground = payload.type === 'background' || payload.type === 'background-video';
      
      let targetDir = mediaImagesDir;
      if (isVideo) targetDir = mediaVideosDir;
      if (isBackground) targetDir = mediaBackgroundsDir;
      
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
      let results = [];
      const isBackground = payload && payload.type === 'background';
      const dirsToScan = isBackground ? [mediaBackgroundsDir] : [mediaImagesDir, mediaVideosDir];
      
      for (const dir of dirsToScan) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const id = path.parse(file).name;
          const formattedPath = path.join(dir, file).replace(/\\/g, '/');
          const fileUrl = formattedPath.startsWith('/') ? `file://${formattedPath}` : `file:///${formattedPath}`;
          results.push({ id, url: fileUrl });
        }
      }
      return { success: true, data: results };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  return { success: false, message: 'Unknown action' };
});
