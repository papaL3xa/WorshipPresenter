# PRD.md — Product Requirements Document
## WorshipPresenter (Web-based EasyWorship Clone)

Versi: 1.0
Status: Draft
Backend: Google Apps Script (GAS) + Google Sheets + Google Drive
Frontend: Static site di GitHub Pages (HTML/CSS/JS, opsional framework ringan)

---

## 1. Latar Belakang & Tujuan

EasyWorship adalah software presentasi ibadah desktop (Windows) yang dipakai gereja untuk menampilkan lirik lagu, ayat Alkitab, pengumuman, video/gambar latar, ke layar proyektor/TV jemaat, terpisah dari layar operator.

Tujuan proyek ini adalah membuat **versi web** dari aplikasi tersebut yang:

1. Bisa diakses dari browser tanpa instalasi (cukup buka link GitHub Pages).
2. Tidak memerlukan server berbayar — backend memakai Google Apps Script (gratis, terikat akun Google) dengan Google Sheets sebagai database dan Google Drive sebagai penyimpanan media.
3. Mendukung alur kerja utama gereja: menyiapkan jadwal ibadah (rundown/playlist), menampilkan lirik lagu & ayat Alkitab secara live, dan mengatur tampilan (background, tema, font).
4. Mendukung 2 layar: **Layar Operator** (control panel) dan **Layar Jemaat** (display output), disinkronkan secara live walau berjalan di device/browser terpisah.

## 2. Target Pengguna

- **Operator/Multimedia gereja**: mengoperasikan software saat ibadah berlangsung.
- **Admin/Worship Leader**: menyiapkan playlist lagu, urutan ibadah, dan konten sebelum ibadah dimulai.
- **Jemaat**: hanya melihat layar output (tidak berinteraksi langsung dengan sistem).

## 3. Ruang Lingkup (Scope)

### 3.1 Termasuk (In-Scope) — versi 1.0 (MVP)

- Manajemen database lagu (judul, lirik per bait/reff/bridge, tag, kategori).
- Manajemen database ayat Alkitab (minimal 1 versi terjemahan, per kitab-pasal-ayat).
- Manajemen media (gambar & video sebagai background), tersimpan di Google Drive.
- Manajemen tema tampilan (warna, font, ukuran teks, posisi teks, background).
- Pembuatan **Playlist/Schedule** (rundown ibadah): daftar item (lagu, ayat, pengumuman, media) dalam satu ibadah.
- **Live Control**: operator memilih item pada playlist → tampil di Layar Jemaat secara real-time (via polling).
- **Stage Display terpisah** dari **Display Window** (opsional: tampilkan slide berikutnya + jam ke operator).
- Blank/Black screen & Logo screen (mode senyap saat tidak ada tampilan).
- Pencarian cepat (quick search) lagu & ayat Alkitab saat live.
- Login sederhana (akun Google, dibatasi ke domain/organisasi gereja) untuk otorisasi akses ke Apps Script API.
- Import lirik lagu dari teks/CSV.
- Ekspor & backup data (Google Sheets sudah otomatis tersimpan di Drive).

### 3.2 Tidak Termasuk (Out of Scope) — untuk versi 1.0

- Real-time streaming/broadcast ke YouTube/Zoom (bisa jadi fase berikutnya).
- Multi-bahasa lirik/terjemahan paralel (dual language) — masuk roadmap fase 2.
- Aplikasi mobile native (Android/iOS) — versi 1 fokus web responsif saja.
- Kolaborasi multi-operator real-time dalam satu sesi (1 operator aktif per sesi ibadah).
- Integrasi lisensi CCLI otomatis (pencatatan lagu untuk pelaporan lisensi) — roadmap fase 2.
- WebSocket real-time murni (karena GAS tidak mendukung WebSocket native) — diganti pendekatan polling/long-polling.

## 4. Fitur Utama (Functional Requirements)

| # | Fitur | Prioritas | Deskripsi Singkat |
|---|-------|-----------|--------------------|
| F1 | Manajemen Lagu | Must | CRUD lagu + lirik terstruktur per bagian (verse/chorus/bridge) |
| F2 | Manajemen Alkitab | Must | Database ayat, pencarian per kitab/pasal/ayat, tampilkan 1 ayat/range ayat |
| F3 | Manajemen Media | Must | Upload gambar/video ke Drive, thumbnail preview, tag kategori |
| F4 | Manajemen Tema | Should | Buat & simpan preset tampilan (font, warna, background) |
| F5 | Playlist/Schedule Ibadah | Must | Susun rundown ibadah dari lagu/ayat/media/pengumuman |
| F6 | Live Presenter Control | Must | Panel kontrol operator: pilih slide, next/prev, blank, live update |
| F7 | Display Window (Output) | Must | Jendela terpisah (fullscreen di layar ke-2/proyektor) menampilkan konten live |
| F8 | Stage Display | Could | Info tambahan untuk operator/singer: next slide, jam, pesan singkat |
| F9 | Pencarian Cepat Saat Live | Must | Search box lagu/ayat tanpa keluar dari mode presentasi |
| F10 | Import/Export Lagu | Should | Import teks lirik massal, ekspor daftar lagu ke CSV |
| F11 | Autentikasi & Hak Akses | Must | Login via Google OAuth (dibatasi via Apps Script), role Admin/Operator |
| F12 | Riwayat Ibadah (History) | Could | Simpan log playlist yang sudah dipakai per tanggal ibadah |
| F13 | Pengaturan Global | Should | Logo gereja, default tema, resolusi output |

## 5. Alur Pengguna Utama (Key User Flows)

1. **Persiapan sebelum ibadah**
   Admin login → buat Playlist baru → tambahkan lagu dari database (atau tambah lagu baru) → tambahkan ayat Alkitab → atur background per item → simpan playlist dengan nama & tanggal ibadah.

2. **Saat ibadah berlangsung**
   Operator buka Playlist ibadah hari itu → buka **Display Window** di layar kedua (fullscreen) → di **Control Panel**, klik item/slide → tampilan otomatis update di Display Window → gunakan tombol Next/Prev/Blank sesuai kebutuhan.

3. **Situasi dadakan (lagu di luar playlist)**
   Operator pakai Quick Search di Control Panel → cari lagu/ayat → klik "Tampilkan Sekarang" → tampil langsung di Display Window tanpa mengubah playlist tersimpan.

## 6. Batasan Teknis Penting (Constraints)

- **Google Apps Script** memiliki kuota eksekusi (6 menit per eksekusi untuk akun biasa, ~90 menit/hari total), limit `UrlFetchApp`, dan batas request per menit — arsitektur harus meminimalkan panggilan berat & memakai caching (lihat architecture.md).
- Tidak ada WebSocket asli di GAS → sinkronisasi live Display Window dan Control Panel dilakukan lewat **polling interval pendek (misal 1 detik)** ke endpoint GAS yang membaca "current state" dari Google Sheets, atau alternatif memakai `BroadcastChannel`/`localStorage` jika Display Window & Control dibuka di browser/device yang sama.
- GitHub Pages hanya menyajikan file statis (tidak ada server-side rendering) → seluruh logic ada di JS sisi klien dan GAS Web App sebagai API JSON.
- CORS harus dikonfigurasi di GAS Web App (`doGet`/`doPost`) agar bisa diakses dari domain GitHub Pages.

## 7. Metrik Keberhasilan (Success Metrics)

- Waktu delay tampilan Display Window setelah operator klik slide < 1.5 detik.
- Operator dapat menyiapkan playlist ibadah standar (± 15 item) dalam < 10 menit.
- Tidak ada error kuota GAS dalam 1 sesi ibadah (± 2 jam pemakaian aktif).

## 8. Roadmap Singkat

- **Fase 1 (MVP)**: F1–F11 seperti di atas.
- **Fase 2**: multi-bahasa lirik, pelaporan CCLI, riwayat ibadah, tema animasi/video transisi.
- **Fase 3**: dukungan multi-operator, remote control dari HP (mirip stage display app), integrasi live streaming overlay.

## 9. Referensi Dokumen Terkait

- `design.md` — desain UI/UX & wireframe tekstual.
- `Rules.md` — aturan bisnis & validasi.
- `schema.md` — struktur data (Google Sheets sebagai DB).
- `architecture.md` — arsitektur sistem & alur komunikasi Frontend–GAS.
