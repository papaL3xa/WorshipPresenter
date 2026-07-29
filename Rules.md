# Rules.md — Aturan Bisnis & Validasi
## WorshipPresenter

Versi: 1.0
Terkait: PRD.md, schema.md

---

## 1. Aturan Umum Akses & Otorisasi

1. Setiap pengguna wajib login menggunakan akun Google (OAuth) sebelum bisa mengakses `dashboard.html` atau halaman manapun selain `login.html` dan `display.html` (Display Window boleh dibuka tanpa login penuh, tetapi tetap butuh token sesi Live yang valid — lihat R-DISP-01).
2. Terdapat 2 role:
   - **Admin**: akses penuh — kelola Song/Bible/Media/Theme, buat/edit/hapus playlist, kelola user lain.
   - **Operator**: hanya bisa membuka playlist yang sudah ada dan menjalankan mode Live/Control Panel; tidak bisa menghapus data master (lagu/ayat/media) atau mengubah playlist orang lain kecuali diberi izin.
3. Daftar email yang diizinkan login disimpan di sheet `Users` (lihat schema.md) dan divalidasi di setiap request API oleh GAS (`doGet`/`doPost`) menggunakan token sesi.
4. Jika email pengguna tidak terdaftar di sheet `Users`, request ditolak dengan `403 Unauthorized`.

## 2. Aturan Data Lagu (Songs)

1. Judul lagu wajib unik (case-insensitive) dalam satu database — jika duplikat terdeteksi saat simpan, sistem menampilkan peringatan "Lagu dengan judul serupa sudah ada" namun tetap mengizinkan simpan jika user konfirmasi (untuk kasus lagu versi lain/aransemen beda).
2. Lirik lagu wajib dipecah per **segmen** (Verse 1, Verse 2, Chorus, Bridge, dst.) — tidak boleh disimpan sebagai satu blok teks panjang tanpa segmen, karena Display Window menampilkan per segmen/slide.
3. Setiap segmen dibatasi maksimal ±500 karakter agar tetap terbaca dalam satu slide (jika melebihi, sistem menyarankan pemecahan otomatis ke slide lanjutan, misalnya "Verse 1 (1/2)").
4. Urutan tampil segmen dalam mode Live mengikuti **urutan default** yang ditentukan saat input lagu (mis. Verse1-Chorus-Verse2-Chorus-Bridge-Chorus), namun operator tetap bisa lompat manual ke segmen manapun saat live.
5. Field kategori/tag bersifat opsional tapi direkomendasikan (mis. "Pujian", "Penyembahan", "Natal") untuk mempermudah pencarian.
6. Penghapusan lagu yang **sedang dipakai** di playlist manapun (status `scheduled` atau `draft`) harus menampilkan peringatan konfirmasi, dan referensi lagu di playlist tersebut ditandai `[Lagu Dihapus]` bukan dihapus permanen dari rundown (agar histori tidak korup).

## 3. Aturan Data Alkitab (Bible)

1. Data ayat Alkitab bersifat **read-heavy** — sekali diimpor (mis. dari 1 file terjemahan), tidak diedit isi teksnya oleh user biasa (mencegah perubahan tidak sengaja pada teks kitab suci). Hanya Admin dengan izin khusus yang dapat mengedit/memperbaiki typo import.
2. Pencarian ayat mendukung format umum: `Yohanes 3:16`, `Yoh 3:16-18`, `Mazmur 23:1-6`.
3. Jika range ayat diminta (mis. 3:16-18), setiap ayat dalam range menjadi **slide terpisah** secara default (bisa digabung manual jadi 1 slide oleh operator jika singkat).
4. Jika versi terjemahan lebih dari satu tersedia di database, operator dapat memilih versi default di Settings; tampilan Live default memakai versi tersebut kecuali diganti manual per item.

## 4. Aturan Media (Media Library)

1. File yang diunggah disimpan ke folder khusus di Google Drive (`WorshipPresenter_Media`), bukan ke Google Sheets (Sheets tidak cocok untuk file biner).
2. Format yang didukung: gambar (`.jpg`, `.png`, `.webp`), video (`.mp4`, `.webm`). File di luar format ini ditolak saat upload.
3. Batas ukuran file per upload disesuaikan dengan kuota Google Drive akun & batas `UrlFetchApp`/payload GAS (rekomendasi: gambar maks 10MB, video maks 100MB — video besar sebaiknya diunggah manual ke Drive lalu ditautkan via link, bukan lewat form upload GAS langsung, karena keterbatasan payload Apps Script).
4. Setiap media yang dihapus dari Media Library namun masih dipakai di suatu tema/playlist, tema/item tersebut otomatis fallback ke background default (warna solid) dan menampilkan tanda peringatan di editor.

## 5. Aturan Playlist / Rundown Ibadah

1. Satu playlist wajib memiliki: nama ibadah, tanggal, minimal 1 item.
2. Urutan item dalam playlist bisa diubah bebas (drag-and-drop) sebelum maupun selama live (perubahan saat live tidak mengubah slide yang sedang tampil sampai operator pindah slide).
3. Status playlist: `draft` (masih disusun), `scheduled` (siap dipakai, tanggal ibadah belum lewat), `live` (sedang dipakai aktif sekarang), `archived` (tanggal ibadah sudah lewat, otomatis berubah status via cek tanggal saat dashboard dimuat).
4. Hanya **satu playlist** yang boleh berstatus `live` dalam satu waktu per organisasi/gereja (mencegah dua operator menjalankan live session berbeda yang bentrok pada Display Window yang sama). Saat operator klik "Mulai Live", sistem mengecek dan mengunci status ini di sheet `LiveState`.
5. Menutup/mengakhiri sesi live (`Selesai Live`) mengubah status kembali ke `scheduled`/`archived` dan mengosongkan `LiveState` (current slide di-reset ke Blank).

## 6. Aturan Live Sync (Control Panel ↔ Display Window)

1. Sumber kebenaran (source of truth) untuk "apa yang sedang tampil" adalah baris di sheet `LiveState` (atau setara), berisi: `playlistId`, `currentItemId`, `currentSegmentIndex`, `displayMode` (`content`/`blank`/`black`/`logo`), `updatedAt`.
2. Setiap aksi Next/Prev/Blank/pilih-slide di Control Panel memicu **write** ke `LiveState` melalui GAS API (`doPost`).
3. Display Window melakukan **polling** ke endpoint GAS (`doGet` dengan aksi `getLiveState`) setiap interval pendek (default 1 detik, dapat dikonfigurasi di Settings) dan hanya me-render ulang jika `updatedAt` berubah dibanding data terakhir yang dimiliki (untuk menghemat kuota & mencegah flicker).
4. Jika Control Panel dan Display Window dibuka pada browser/tab yang sama (misal dual-monitor dari 1 device), sistem **boleh** menggunakan `BroadcastChannel`/`localStorage` sebagai jalur sinkronisasi cepat (near-instant) sebagai optimisasi tambahan di atas polling GAS, bukan pengganti (agar tetap sinkron lintas device juga).
5. Jika polling ke GAS gagal (kuota habis/error jaringan) selama > 5 detik berturut-turut, Display Window menampilkan indikator kecil "Koneksi terputus" (opsional, hanya di mode developer/log, tidak mengganggu tampilan jemaat) dan mencoba reconnect otomatis dengan backoff.

## 7. Aturan Validasi Input Umum

1. Semua input teks (judul lagu, nama playlist, dsb.) di-trim whitespace dan divalidasi tidak boleh kosong sebelum simpan.
2. Semua request ke GAS API wajib menyertakan token sesi valid di header/parameter; request tanpa token ditolak `401`.
3. Semua response error dari GAS API mengikuti format konsisten: `{ "success": false, "error": { "code": "...", "message": "..." } }` agar frontend bisa menampilkan pesan yang seragam (lihat schema.md bagian API Response).
4. Rate-limit sisi frontend: tombol Next/Prev di-*debounce* minimal 150ms untuk mencegah double-submit akibat klik ganda/koneksi lambat.

## 8. Aturan Kuota & Batas Teknis Google Apps Script

1. Operator/Admin harus diberi peringatan di Settings bahwa GAS memiliki batas eksekusi harian; disarankan tidak menjalankan polling lebih cepat dari 1 request/detik per Display Window aktif.
2. Untuk gereja dengan lebih dari 1 Display Window aktif bersamaan (mis. 2 proyektor beda ruangan menampilkan konten sama), gunakan **satu polling shared** via `BroadcastChannel` bila memungkinkan (satu tab "master" polling, tab lain ikut lewat broadcast) untuk mengurangi jumlah request ke GAS.
3. Operasi tulis massal (misalnya import CSV ratusan lagu) harus di-*batch* (mis. 50 baris per request) agar tidak melebihi waktu eksekusi maksimum 6 menit per panggilan GAS.

## 9. Aturan Backup & Integritas Data

1. Karena database utama adalah Google Sheets, versi/riwayat perubahan otomatis tersedia lewat fitur "Version History" bawaan Google Sheets — tidak perlu dibangun ulang sistem versioning kustom di MVP.
2. Playlist yang sudah lewat tanggal ibadahnya (`archived`) tidak boleh dihapus otomatis oleh sistem; hanya bisa dihapus manual oleh Admin, untuk menjaga histori pemakaian lagu (berguna untuk pelaporan lisensi lagu di fase berikutnya).
