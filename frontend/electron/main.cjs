const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Memaksa aplikasi agar mengabaikan scaling display OS (misal: 150%)
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Path to local spreadsheet/json database
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
    // payload = { id: string, dataUrl: string, type: 'image' | 'video' }
    try {
      const isVideo = payload.type === 'video' || payload.id.includes('_vid_');
      const targetDir = isVideo ? mediaVideosDir : mediaImagesDir;
      const extension = isVideo ? 'webm' : 'jpg'; // Asumsi default. Bisa disesuaikan dari mime type.
      
      let filePath = path.join(targetDir, `${payload.id}.${extension}`);
      
      if (payload.filePath) {
        // Jika dari file picker lokal (seperti video/mp4 besar), kita bisa langsung copy file-nya!
        const originalExt = path.extname(payload.filePath);
        filePath = path.join(targetDir, `${payload.id}${originalExt}`);
        fs.copyFileSync(payload.filePath, filePath);
        return { success: true, id: payload.id, url: `file://${filePath.replace(/\\/g, '/')}` };
      }
      
      if (payload.dataUrl) {
        // Dari base64 canvas compress
        const matches = payload.dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
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
        results.push({
          id: f.split('.')[0],
          url: `file://${path.join(mediaImagesDir, f).replace(/\\/g, '/')}`,
          type: 'image'
        });
      });
      
      const videos = fs.existsSync(mediaVideosDir) ? fs.readdirSync(mediaVideosDir) : [];
      videos.forEach(f => {
        results.push({
          id: f.split('.')[0],
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
