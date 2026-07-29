# design.md — UI/UX Design Document
## WorshipPresenter

Versi: 1.0
Terkait: PRD.md, Rules.md

---

## 1. Prinsip Desain

1. **Operator-first**: UI kontrol harus cepat dipakai dalam kondisi panik/live, tombol besar, shortcut keyboard tersedia.
2. **Clarity over decoration**: layar jemaat (Display Window) harus bersih, minim distraksi, kontras tinggi agar lirik/ayat mudah dibaca dari jarak jauh.
3. **Dua konteks visual berbeda**:
   - **Control Panel** (untuk operator) → padat informasi, banyak tombol, mode "aplikasi kerja".
   - **Display Window** (untuk jemaat/proyektor) → full-bleed, hanya teks + background, tanpa UI apapun.
4. **Konsisten dengan pola EasyWorship** agar operator yang sudah terbiasa tidak butuh belajar ulang.

## 2. Struktur Halaman (Screens)

| Screen | Deskripsi |
|--------|-----------|
| `login.html` | Login via Google OAuth |
| `dashboard.html` | Daftar playlist/jadwal ibadah, pintasan ke Song/Bible/Media Library |
| `song-library.html` | CRUD lagu |
| `bible-library.html` | Pencarian & pengelolaan ayat Alkitab |
| `media-library.html` | Upload & kelola gambar/video background |
| `theme-editor.html` | Buat/edit preset tema tampilan |
| `playlist-editor.html` | Susun rundown ibadah |
| `control.html` | **Control Panel** — dipakai live saat ibadah |
| `display.html` | **Display Window** — dibuka di layar kedua/proyektor, fullscreen |
| `stage.html` | Stage Display (opsional, untuk singer/operator kedua) |
| `settings.html` | Pengaturan umum aplikasi (logo, resolusi default, dsb.) |

## 3. Wireframe Tekstual per Halaman Kunci

### 3.1 Dashboard
```
┌─────────────────────────────────────────────────┐
│ [Logo] WorshipPresenter        [User] [Logout]   │
├─────────────────────────────────────────────────┤
│ [+ Playlist Baru]   [Song Library] [Bible] [Media]│
├─────────────────────────────────────────────────┤
│ Jadwal Ibadah Mendatang                          │
│  • Minggu, 3 Agu 2026 - Ibadah Umum   [Buka][Live]│
│  • Rabu, 6 Agu 2026 - Doa Malam       [Buka][Live]│
│ Riwayat Ibadah                                   │
│  • 27 Jul 2026 - Ibadah Umum          [Lihat]     │
└─────────────────────────────────────────────────┘
```

### 3.2 Playlist Editor
```
┌───────────────────────────────┬───────────────────┐
│ RUNDOWN IBADAH (drag to sort) │  PANEL TAMBAH ITEM │
│ 1. [Lagu] Bapa Kami Bersyukur │  [Cari Lagu......] │
│ 2. [Ayat] Yohanes 3:16        │  [Cari Ayat.......] │
│ 3. [Media] Video Countdown    │  [+ Pengumuman]    │
│ 4. [Lagu] Kau Yang Terindah   │  [+ Media/Bg]      │
│ 5. [Pengumuman] Info Retreat  │                    │
│ [+ Tambah item lain]          │                    │
├───────────────────────────────┴───────────────────┤
│ [Simpan Playlist]     [Mulai Live Sekarang →]      │
└─────────────────────────────────────────────────────┘
```

### 3.3 Control Panel (`control.html`) — Layar Operator
```
┌──────────────────────────────────────────────────────────────┐
│ [Judul Ibadah: Ibadah Umum - 3 Agu 2026]     [● LIVE] [Buka Display] │
├───────────────────┬────────────────────────────┬─────────────┤
│ RUNDOWN            │ PREVIEW SLIDE AKTIF         │ QUICK SEARCH │
│ ▶ 1. Bapa Kami...   │  ┌──────────────────────┐  │ [__________] │
│   2. Yohanes 3:16   │  │  (thumbnail slide)   │  │ Hasil:       │
│   3. Video Countdown│  │  Lirik bait 1 tampil  │  │ - Lagu A     │
│   4. Kau Yang...    │  └──────────────────────┘  │ - Lagu B     │
│   5. Pengumuman     │  Bait: [1][2][Reff][3]     │ - Yoh 3:16   │
│                     │                             │              │
├─────────────────────┴────────────────────────────┴─────────────┤
│ [⏮ Prev] [⏭ Next] [◼ Blank] [🖤 Black] [🖼 Logo] [🔊 Live On/Off] │
└──────────────────────────────────────────────────────────────┘
```
Catatan:
- Kolom kiri: daftar item rundown, klik = pindah ke slide pertama item itu.
- Kolom tengah: preview + navigasi bait/segmen dalam 1 item lagu (mirror dari apa yang tampil di Display Window, TIDAK sama dengan tampilan jemaat — ada label & border di sini).
- Kolom kanan: quick search untuk kebutuhan dadakan, hasil klik langsung mengubah slide aktif tanpa mengubah rundown tersimpan.
- Baris bawah: tombol kontrol utama, dilengkapi shortcut keyboard (Space/→ = Next, ←/Backspace = Prev, B = Blank, L = Logo).

### 3.4 Display Window (`display.html`) — Layar Jemaat
```
┌──────────────────────────────────────────────────┐
│                                                    │
│                                                    │
│              (background image/video)             │
│                                                    │
│          "Kasih setia-Mu Tuhan tiada berkesudahan" │
│                                                    │
│                                                    │
└──────────────────────────────────────────────────┘
```
- Tidak ada tombol/menu apapun terlihat (hanya konten). Klik kanan/keluar fullscreen memakai tombol standar browser (F11/Esc), bukan UI kustom.
- Mode Blank = layar polos sesuai warna tema (biasanya hitam).
- Mode Logo = menampilkan logo gereja di tengah, background gelap.
- Transisi antar slide: fade sederhana (CSS transition), durasi dapat diatur di Theme Editor (default 300ms).

### 3.5 Stage Display (opsional)
```
┌─────────────────────────────┐
│ 14:32:07          Slide 3/5 │
│ SEKARANG:                   │
│  Bapa Kami Bersyukur - Bait 2│
│ BERIKUTNYA:                  │
│  Bapa Kami Bersyukur - Reff  │
├─────────────────────────────┤
│ Pesan operator: -            │
└─────────────────────────────┘
```

## 4. Sistem Tema (Theme Editor)

Setiap tema memiliki properti:
- Background: warna solid / gambar / video loop (dari Media Library).
- Font: nama font, ukuran (dengan opsi auto-fit jika teks panjang), warna teks, warna outline/shadow.
- Posisi teks: atas/tengah/bawah, rata kiri/tengah/kanan.
- Padding/safe-area (agar teks tidak terlalu mepet ke tepi proyektor).
- Durasi transisi antar slide.

Tema bisa disetel per-item pada playlist (override tema default), atau tema global default.

## 5. Navigasi & Shortcut Keyboard (Control Panel)

| Tombol | Fungsi |
|--------|--------|
| Panah kanan / Space | Next segmen/slide |
| Panah kiri | Prev segmen/slide |
| Panah bawah | Loncat ke item rundown berikutnya |
| Panah atas | Loncat ke item rundown sebelumnya |
| B | Toggle Blank screen |
| L | Toggle Logo screen |
| Esc | Batalkan quick search / tutup modal |
| Ctrl+F / `/` | Fokus ke Quick Search |

## 6. Responsivitas

- **Control Panel**: didesain utama untuk layar desktop/laptop (≥1280px). Tetap dibuat responsif dasar agar bisa dipakai di tablet.
- **Display Window**: harus mendukung berbagai rasio (16:9, 4:3) karena proyektor gereja bervariasi; gunakan `object-fit: cover` untuk background dan font-size relatif (`vw`/`vh` clamp) agar auto-scale.
- **Library pages (song/bible/media)**: layout grid/list standar, responsif ke tablet.

## 7. Aksesibilitas & Keterbacaan

- Kontras teks-background minimum WCAG AA (4.5:1) sebagai default tema, dengan opsi outline/shadow otomatis jika background berupa foto.
- Ukuran font default besar (min. 48px setara proyeksi) agar terbaca dari jarak jauh.
- Semua tombol kontrol punya label teks selain ikon (hindari icon-only tanpa tooltip).

## 8. Komponen UI yang Dipakai Ulang (Reusable Components)

- `SlideThumbnail` — preview kecil untuk rundown/list.
- `SearchBox` — dipakai di song/bible library & quick search.
- `ItemCard` (Lagu/Ayat/Media/Pengumuman) — representasi 1 item rundown.
- `ThemePicker` — dropdown pilih tema per item.
- `ModalConfirm` — konfirmasi hapus/replace data.
- `ToastNotification` — notifikasi hasil simpan/error dari GAS API.

## 9. Catatan Desain Teknis Frontend

- Bisa dibangun dengan HTML/CSS/Vanilla JS murni (agar ringan di GitHub Pages) atau framework ringan (Alpine.js/Vue via CDN) — hindari framework yang butuh build step kompleks supaya cocok untuk deploy statis GitHub Pages tanpa CI/CD build khusus (kecuali menambahkan GitHub Actions untuk build, opsional fase 2).
- State sinkronisasi Control ↔ Display dijelaskan di `architecture.md` (bagian Live Sync).
