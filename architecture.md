# architecture.md — Arsitektur Sistem
## WorshipPresenter

Versi: 1.0
Terkait: PRD.md, schema.md, Rules.md

---

## 1. Gambaran Umum Arsitektur

```
┌───────────────────────────┐         ┌─────────────────────────────┐
│   GitHub Pages (Frontend) │  HTTPS  │   Google Apps Script (Backend)│
│  ─────────────────────── │ fetch() │  ─────────────────────────── │
│  control.html             │───────▶│  doGet(e) / doPost(e)         │
│  display.html              │◀───────│  Router → Service functions   │
│  dashboard.html, dll.       │        │                               │
└───────────────────────────┘         └───────────┬───────────────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                     ▼                     ▼
                     ┌────────────────┐   ┌──────────────────┐  ┌─────────────────┐
                     │ Google Sheets  │   │  Google Drive     │  │ PropertiesService│
                     │ (WorshipPresenter_DB)│ (Media files)  │  │ (cache/token kecil)│
                     └────────────────┘   └──────────────────┘  └─────────────────┘
```

- **Frontend**: hosted statis di GitHub Pages (repo publik/privat + Pages enabled). Semua file HTML/CSS/JS.
- **Backend**: 1 Google Apps Script project, di-deploy sebagai **Web App** (`doGet`/`doPost`), memberikan REST-like JSON API.
- **Database**: Google Sheets (`WorshipPresenter_DB`) diakses lewat `SpreadsheetApp` di sisi GAS — frontend **tidak pernah** mengakses Sheets API langsung, semua lewat GAS sebagai perantara (menyembunyikan spreadsheet ID & menjaga validasi terpusat).
- **Media**: file di Google Drive, diakses langsung via link publik read-only dari `display.html` (tanpa lewat GAS, agar cepat & tidak membebani kuota eksekusi GAS untuk streaming file besar).

## 2. Alasan Pemilihan Arsitektur

| Aspek | Pilihan | Alasan |
|-------|---------|--------|
| Hosting frontend | GitHub Pages | Gratis, mudah deploy via git push, cocok untuk static site |
| Backend | Google Apps Script | Gratis, terintegrasi native dengan Google Sheets/Drive, tidak perlu server sendiri |
| Database | Google Sheets | Mudah diedit manual jika perlu, auto-backup/version history, cukup untuk skala 1 organisasi/gereja |
| File media | Google Drive | Kapasitas besar, gratis (mengikuti kuota akun Google), streaming langsung ke browser tanpa lewat GAS |
| Sinkronisasi live | Polling (+ opsional BroadcastChannel lokal) | GAS tidak mendukung WebSocket asli; polling interval pendek cukup untuk kebutuhan presentasi ibadah |

## 3. Struktur Proyek

### 3.1 Repo Frontend (GitHub Pages)
```
worshippresenter-frontend/
 ├─ index.html                 (redirect ke login/dashboard)
 ├─ login.html
 ├─ dashboard.html
 ├─ song-library.html
 ├─ bible-library.html
 ├─ media-library.html
 ├─ theme-editor.html
 ├─ playlist-editor.html
 ├─ control.html
 ├─ display.html
 ├─ stage.html
 ├─ settings.html
 ├─ /assets
 │   ├─ /css
 │   ├─ /img
 │   └─ /fonts
 ├─ /js
 │   ├─ api.js          (wrapper fetch ke GAS Web App URL)
 │   ├─ auth.js          (handle login Google OAuth + simpan token sesi)
 │   ├─ liveSync.js       (logic polling + BroadcastChannel)
 │   ├─ control.js
 │   ├─ display.js
 │   ├─ playlistEditor.js
 │   └─ ...
 └─ config.js            (berisi GAS_WEB_APP_URL, dll — bukan rahasia sensitif)
```

### 3.2 Proyek Backend (Google Apps Script)
```
WorshipPresenter_Backend (Apps Script Project)
 ├─ Code.gs             (entry point: doGet, doPost, router)
 ├─ Auth.gs             (validasi token/sesi, cek email di sheet Users)
 ├─ SongService.gs       (CRUD Songs & SongSegments)
 ├─ BibleService.gs      (query BibleVerses)
 ├─ MediaService.gs      (upload ke Drive, CRUD metadata Media)
 ├─ ThemeService.gs      (CRUD Themes)
 ├─ PlaylistService.gs   (CRUD Playlists & PlaylistItems)
 ├─ LiveStateService.gs  (get/set LiveState, single-row update)
 ├─ SettingsService.gs   (get/set Settings)
 └─ Utils.gs             (helper: generateId, respondJson, CORS headers, cache)
```

## 4. Alur Request API (Router Pattern)

Karena GAS Web App hanya punya satu `doGet` dan satu `doPost`, dipakai pola router berbasis parameter `action`:

```javascript
// Code.gs
function doGet(e) {
  return handleRequest(e, "GET");
}
function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  const action = e.parameter.action;
  const auth = Auth.validate(e); // cek token sesi
  if (!auth.valid) return respondJson({ success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid" } });

  const routes = {
    getPlaylist: PlaylistService.get,
    savePlaylist: PlaylistService.save,
    getLiveState: LiveStateService.get,
    setLiveState: LiveStateService.set,
    searchSongs: SongService.search,
    searchBible: BibleService.search,
    // ...dst
  };

  const handler = routes[action];
  if (!handler) return respondJson({ success: false, error: { code: "NOT_FOUND", message: "Aksi tidak dikenali" } });

  try {
    const result = handler(e, auth.user);
    return respondJson({ success: true, data: result });
  } catch (err) {
    return respondJson({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
}
```

Frontend memanggil lewat `api.js`:
```javascript
async function callApi(action, params = {}, method = "GET") {
  const url = new URL(CONFIG.GAS_WEB_APP_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("token", getSessionToken());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, { method });
  return res.json();
}
```

> Catatan CORS: GAS Web App yang di-deploy dengan akses "Anyone" secara default mengizinkan request lintas origin untuk `doGet`; untuk `doPost` dengan body JSON kompleks, disarankan tetap mengirim data via `URLSearchParams`/query string atau `text/plain` body agar tidak memicu CORS preflight yang bermasalah di GAS.

## 5. Alur Autentikasi

1. User klik "Login dengan Google" di `login.html` → memakai Google Identity Services (client-side OAuth, `client_id` dari Google Cloud Console project yang sama/terhubung dengan akun GAS).
2. Frontend menerima ID Token dari Google → kirim ke GAS action `login` untuk divalidasi (`Auth.gs` memverifikasi token & mencocokkan email dengan sheet `Users`).
3. GAS mengembalikan **session token** sederhana (mis. UUID yang disimpan sementara di `CacheService`/`PropertiesService` dengan expiry, dipetakan ke `userId`).
4. Frontend menyimpan session token di `sessionStorage` (bukan `localStorage`, agar otomatis hilang saat tab ditutup — mengurangi risiko sesi menggantung di komputer gereja yang dipakai bersama).
5. Setiap request API berikutnya menyertakan `token` ini sebagai parameter, divalidasi ulang oleh `Auth.validate()`.

**Pengecualian**: `display.html` (Display Window) dapat dibuka dengan **token sesi live khusus** yang bersifat read-only (hanya boleh memanggil `getLiveState`), sehingga bisa dibuka di device/monitor terpisah (mis. laptop tersambung proyektor) tanpa perlu login akun Google penuh di device tersebut — token ini digenerate oleh Control Panel saat menekan "Buka Display" dan diteruskan lewat parameter URL (`display.html?liveToken=...`).

## 6. Live Sync — Detail Implementasi

### 6.1 Alur Dasar (Polling)
```
Control Panel                     GAS Backend                Display Window
     │  klik "Next"                    │                            │
     │ ───setLiveState(action)───────▶ │                            │
     │                                  │ update baris LiveState     │
     │                                  │ (updatedAt = now())        │
     │ ◀────ok───────────────────────  │                            │
     │                                  │ ◀───getLiveState (poll 1s)─│
     │                                  │ ───state terbaru──────────▶│
     │                                  │                            │ render ulang jika
     │                                  │                            │ updatedAt berubah
```

### 6.2 Optimisasi Tambahan (Same-Device / Same-Browser)
Jika Control Panel & Display Window dibuka di browser yang sama (2 tab, misalnya di-drag ke monitor kedua):
```javascript
// liveSync.js
const channel = new BroadcastChannel("worship_live_sync");

// Control Panel: setelah berhasil setLiveState via GAS, broadcast juga secara lokal
channel.postMessage({ type: "STATE_UPDATE", state: newState });

// Display Window: dengar broadcast lokal (instan) SEKALIGUS tetap polling GAS (fallback lintas device)
channel.onmessage = (msg) => {
  if (msg.data.type === "STATE_UPDATE") applyState(msg.data.state);
};
setInterval(pollGasLiveState, CONFIG.pollingIntervalMs);
```
Ini memberi pengalaman "instan" saat 1 device, namun tetap berfungsi benar saat Display Window ada di device terpisah (laptop lain via proyektor jaringan/HDMI extender + browser sendiri), karena tetap mengandalkan polling GAS sebagai jalur utama lintas device.

### 6.3 Struktur `LiveState` sebagai Single-Row
Agar `getLiveState` selalu cepat (tidak perlu scan sheet), sheet `LiveState` dijaga hanya berisi 1 baris data aktif per waktu (baris ke-2, setelah header) yang di-*overwrite* terus oleh `LiveStateService.set()`, bukan di-*append*. Riwayat perubahan slide tidak perlu disimpan granular (cukup riwayat playlist per tanggal ibadah di sheet `Playlists`/`PlaylistItems`).

## 7. Manajemen Kuota Google Apps Script

| Batasan GAS (akun konsumer biasa) | Mitigasi Arsitektur |
|-----------------------------------|----------------------|
| Maks ±6 menit per eksekusi | Setiap `doGet`/`doPost` dirancang ringan (baca/tulis 1 baris atau range kecil), bukan operasi berat |
| Kuota total eksekusi harian terbatas | Batasi interval polling minimum 1 detik/Display Window; gunakan `BroadcastChannel` untuk kurangi request saat same-device |
| `UrlFetchApp`/payload request terbatas | Upload video besar dilakukan manual ke Drive lalu ditautkan, bukan upload langsung lewat form ke GAS |
| Baca `getDataRange()` pada sheet besar (`BibleVerses`) lambat | Gunakan `Range` spesifik berdasar index kitab-pasal yang sudah dipetakan di awal (cache index di `CacheService`), atau simpan Alkitab sebagai file JSON di Drive dan baca dengan `DriveApp`/`UrlFetchApp` alih-alih `SpreadsheetApp` |

## 8. Deployment

### 8.1 Backend (GAS)
1. Buat Google Apps Script project baru, tempel isi file `.gs` sesuai struktur di atas.
2. Hubungkan ke Spreadsheet `WorshipPresenter_DB` (via `SpreadsheetApp.openById(SPREADSHEET_ID)`).
3. Deploy → **New deployment** → tipe **Web app** → Execute as: `Me`, Who has access: `Anyone` (agar bisa diakses dari GitHub Pages tanpa login Google Workspace tambahan) atau `Anyone within organization` jika akun Google Workspace gereja tersedia (lebih aman).
4. Salin URL Web App (`https://script.google.com/macros/s/XXXX/exec`) ke `config.js` di frontend sebagai `GAS_WEB_APP_URL`.

### 8.2 Frontend (GitHub Pages)
1. Push seluruh folder frontend ke repo GitHub.
2. Aktifkan **GitHub Pages** di Settings repo → source: branch `main` folder root (atau `/docs`).
3. Update `config.js` dengan URL Web App GAS terbaru setiap kali dibuat deployment baru dari GAS (karena URL berubah tiap versi deployment baru dibuat, kecuali memakai deployment yang sama dan hanya update kode via "Manage deployments" → edit versi tanpa ganti URL).

## 9. Diagram Alur Data End-to-End (Contoh: Operator Klik "Next")

1. Operator klik Next di `control.html`.
2. `control.js` memanggil `api.js → callApi("setLiveState", {...})`.
3. Request sampai ke GAS `doPost` → router → `LiveStateService.set()`.
4. `LiveStateService.set()` menulis ke sheet `LiveState` (overwrite baris tunggal), set `updatedAt = Date.now()`.
5. GAS balas `{ success: true }` ke Control Panel.
6. Control Panel (opsional) broadcast lokal via `BroadcastChannel`.
7. `display.html` (polling tiap 1 detik) memanggil `getLiveState` → GAS baca baris `LiveState` → kembalikan JSON.
8. `display.js` bandingkan `updatedAt` baru vs cache lokal → jika beda, ambil detail konten (segmen lagu/ayat terkait) dan render ulang slide dengan transisi sesuai `Themes`.

## 10. Pertimbangan Skalabilitas & Batasan yang Perlu Disadari Tim

- Arsitektur ini didesain untuk **skala 1 gereja/organisasi** (bukan SaaS multi-tenant). Jika ke depan ingin multi-gereja, perlu 1 Spreadsheet + 1 deployment GAS per organisasi, atau menambah kolom `orgId` di setiap sheet dan memisah folder Drive per organisasi.
- Karena bergantung pada 1 akun Google sebagai eksekutor GAS, disarankan memakai akun Google Workspace/akun khusus milik gereja (bukan akun pribadi staf) agar tidak terputus jika staf tersebut berganti.
- Untuk kebutuhan reliabilitas lebih tinggi (mis. gereja besar dengan banyak jemaat & risiko delay tidak bisa ditoleransi), pertimbangkan migrasi backend ke Firebase Realtime Database/Firestore (yang punya real-time listener native) di fase berikutnya — namun ini mengubah keputusan "GAS-only" pada PRD versi 1.0 saat ini dan perlu direncanakan sebagai fase 2/3.
