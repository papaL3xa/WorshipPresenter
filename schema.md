# schema.md — Struktur Data
## WorshipPresenter

Versi: 1.0
Database utama: **Google Sheets** (1 Spreadsheet, banyak sheet/tab sebagai "tabel")
Penyimpanan file: **Google Drive** (folder terpisah untuk media)

---

## 1. Ringkasan Spreadsheet

Nama Spreadsheet: `WorshipPresenter_DB`

| Sheet (Tab) | Fungsi |
|-------------|--------|
| `Users` | Daftar user & role |
| `Songs` | Data master lagu |
| `SongSegments` | Lirik per segmen (relasi ke Songs) |
| `BibleVerses` | Data ayat Alkitab |
| `Media` | Metadata media (link ke Google Drive) |
| `Themes` | Preset tema tampilan |
| `Playlists` | Data rundown ibadah (header) |
| `PlaylistItems` | Item-item dalam satu playlist (relasi ke Playlists) |
| `LiveState` | State "sedang tampil apa sekarang" (1 baris aktif per sesi live) |
| `Settings` | Pengaturan global aplikasi |

Semua ID menggunakan string unik (mis. `UUID` sederhana atau `prefix + timestamp + random`), dibuat di sisi GAS saat insert.

---

## 2. Detail Tiap Sheet

### 2.1 `Users`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| userId | string | ID unik |
| email | string | Email Google, dipakai untuk validasi login |
| name | string | Nama tampilan |
| role | enum | `admin` \| `operator` |
| createdAt | datetime | Waktu ditambahkan |
| active | boolean | Nonaktifkan akses tanpa hapus baris |

### 2.2 `Songs`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| songId | string | ID unik |
| title | string | Judul lagu |
| author | string | Pencipta/arranger (opsional) |
| category | string | Tag/kategori, dipisah koma jika lebih dari satu |
| defaultThemeId | string | FK ke `Themes` (opsional, override tema default) |
| segmentOrder | string | Urutan default segmen, disimpan sebagai JSON array of segmentId, mis. `["seg1","seg3","seg2","seg3"]` (memungkinkan repeat Chorus) |
| createdAt | datetime | |
| updatedAt | datetime | |
| createdBy | string | FK ke `Users.userId` |

### 2.3 `SongSegments`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| segmentId | string | ID unik |
| songId | string | FK ke `Songs` |
| label | string | mis. `Verse 1`, `Chorus`, `Bridge` |
| text | string | Isi lirik segmen (maks ±500 karakter, lihat Rules.md) |
| order | number | Urutan tampil default di dalam daftar segmen lagu (untuk ditampilkan di editor, bukan urutan live — urutan live memakai `Songs.segmentOrder`) |

### 2.4 `BibleVerses`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| verseId | string | ID unik, mis. `KJV_JOH_3_16` |
| translationCode | string | mis. `TB`, `NIV`, `KJV` |
| book | string | Nama kitab, mis. `Yohanes` |
| bookAbbr | string | Singkatan, mis. `Yoh` (untuk pencarian cepat) |
| chapter | number | Nomor pasal |
| verse | number | Nomor ayat |
| text | string | Isi teks ayat |

> Catatan: sheet ini bisa berukuran besar (puluhan ribu baris untuk 1 Alkitab penuh). Pertimbangkan menyimpannya sebagai **JSON di Google Drive** (bukan Sheets) jika performa baca via Sheets API terasa lambat — lihat architecture.md bagian "Opsi Penyimpanan Alkitab".

### 2.5 `Media`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| mediaId | string | ID unik |
| type | enum | `image` \| `video` |
| fileName | string | Nama file asli |
| driveFileId | string | ID file di Google Drive |
| driveUrl | string | Link akses/preview file |
| thumbnailUrl | string | Link thumbnail (untuk gambar/video) |
| tags | string | Tag pencarian, dipisah koma |
| uploadedBy | string | FK ke `Users.userId` |
| uploadedAt | datetime | |

### 2.6 `Themes`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| themeId | string | ID unik |
| name | string | Nama preset, mis. `Tema Natal` |
| backgroundType | enum | `color` \| `image` \| `video` |
| backgroundValue | string | Kode warna HEX, atau `mediaId` jika image/video |
| fontFamily | string | Nama font |
| fontSize | string | mis. `56px` atau nilai clamp CSS |
| fontColor | string | Kode warna HEX |
| textOutline | string | Kode warna outline/shadow (opsional) |
| textPosition | enum | `top` \| `middle` \| `bottom` |
| textAlign | enum | `left` \| `center` \| `right` |
| transitionMs | number | Durasi transisi antar slide (ms) |
| isDefault | boolean | Tema default global |

### 2.7 `Playlists`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| playlistId | string | ID unik |
| name | string | Nama ibadah, mis. `Ibadah Umum` |
| serviceDate | date | Tanggal ibadah |
| status | enum | `draft` \| `scheduled` \| `live` \| `archived` |
| createdBy | string | FK ke `Users.userId` |
| createdAt | datetime | |
| updatedAt | datetime | |

### 2.8 `PlaylistItems`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| itemId | string | ID unik |
| playlistId | string | FK ke `Playlists` |
| order | number | Urutan tampil dalam rundown |
| itemType | enum | `song` \| `bible` \| `media` \| `announcement` |
| refId | string | FK sesuai `itemType`: `songId` / `verseId` (atau range) / `mediaId` / null |
| customText | string | Untuk `announcement` (teks bebas, boleh multi-slide dipisah `\n---\n`) |
| themeOverrideId | string | FK ke `Themes`, opsional (override tema default item) |
| verseRangeEnd | string | Khusus `itemType=bible` jika range ayat, simpan `verseId` akhir |

### 2.9 `LiveState`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| sessionId | string | ID sesi live aktif (biasanya = `playlistId` yang sedang live) |
| playlistId | string | FK ke `Playlists` yang sedang live |
| currentItemId | string | FK ke `PlaylistItems` |
| currentSegmentIndex | number | Index segmen/slide aktif dalam item tsb (0-based) |
| displayMode | enum | `content` \| `blank` \| `black` \| `logo` |
| updatedAt | datetime (timestamp ms) | Dipakai Display Window untuk deteksi perubahan (lihat Rules.md §6) |
| updatedBy | string | FK ke `Users.userId` (operator yang mengubah) |

> Sheet ini idealnya **hanya berisi 1 baris aktif** (single-row state) untuk mempermudah polling — lihat architecture.md untuk opsi implementasi (1 baris tetap yang di-*update* terus vs riwayat append-only + ambil baris terakhir).

### 2.10 `Settings`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| key | string | Nama pengaturan, mis. `churchLogoMediaId`, `defaultThemeId`, `defaultBibleTranslation`, `pollingIntervalMs` |
| value | string | Nilai pengaturan (disimpan sebagai string, di-parse sesuai kebutuhan di frontend) |

---

## 3. Format Data Pertukaran API (JSON)

Contoh response `getPlaylist`:
```json
{
  "success": true,
  "data": {
    "playlistId": "pl_20260803_umum",
    "name": "Ibadah Umum",
    "serviceDate": "2026-08-03",
    "status": "scheduled",
    "items": [
      {
        "itemId": "it_001",
        "order": 1,
        "itemType": "song",
        "refId": "song_bapakami001",
        "themeOverrideId": null
      },
      {
        "itemId": "it_002",
        "order": 2,
        "itemType": "bible",
        "refId": "TB_JOH_3_16",
        "verseRangeEnd": "TB_JOH_3_18"
      }
    ]
  }
}
```

Contoh response `getLiveState`:
```json
{
  "success": true,
  "data": {
    "sessionId": "pl_20260803_umum",
    "playlistId": "pl_20260803_umum",
    "currentItemId": "it_001",
    "currentSegmentIndex": 2,
    "displayMode": "content",
    "updatedAt": 1785312345123
  }
}
```

Contoh format error (mengikuti Rules.md §7.3):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Sesi login tidak valid atau kadaluarsa."
  }
}
```

## 4. Struktur Folder Google Drive

```
WorshipPresenter_Media/
 ├─ images/
 ├─ videos/
 └─ thumbnails/
```

Setiap file diberi permission "Anyone with link can view" (read-only) agar dapat diakses langsung oleh `display.html` tanpa autentikasi tambahan (karena Display Window bisa dibuka sebagai jendela terpisah tanpa sesi login penuh — lihat Rules.md R-DISP-01 & architecture.md).

## 5. Indeks & Optimasi Pencarian

- `Songs`: indeks pencarian dilakukan di sisi client (fetch semua judul lagu sekali, cache di memori/`sessionStorage`, filter lokal saat mengetik) untuk menghindari banyak request ke GAS saat live search.
- `BibleVerses`: karena volume besar, disarankan pencarian per kitab-pasal dilakukan lewat GAS function yang membaca sheet dengan `Range` spesifik (bukan `getDataRange()` seluruh sheet) berdasarkan indeks baris yang sudah dipetakan (lihat architecture.md).
