# Panduan Berkontribusi (Contributing Guide)

Terima kasih atas minat Anda untuk berkontribusi pada **Worship Presenter**! Aplikasi ini bersifat *Open Source*, dan kami sangat menyambut baik segala bentuk kontribusi dari komunitas, mulai dari melaporkan *bug*, menambahkan lirik lagu, hingga ikut mengembangkan fitur kode.

Berikut adalah langkah-langkah untuk berkontribusi pada proyek ini:

## 1. Melaporkan Bug atau Meminta Fitur
Jika Anda menemukan *bug* (celah/kerusakan) atau memiliki ide fitur baru:
1. Buka halaman **Issues** di repositori GitHub kami.
2. Cari terlebih dahulu apakah masalah/ide tersebut sudah pernah dilaporkan oleh orang lain.
3. Jika belum, klik **New Issue** dan jelaskan masalah atau ide Anda secara detail.
   - Sertakan langkah-langkah untuk menghasilkan *bug* tersebut (*Steps to reproduce*).
   - Jika memungkinkan, lampirkan tangkapan layar (*screenshot*).

## 2. Berkontribusi Menambah Koleksi Lagu (Lirik)
Aplikasi ini dirancang untuk bekerja secara 100% offline. Lirik lagu disimpan dalam database TSV dan JSON lokal.
Jika Anda ingin menyumbangkan lirik lagu rohani yang belum ada:
1. Anda bisa mengirimkannya melalui tab **Issues** dengan judul `[LAGU BARU] Judul Lagu`.
2. Atau, jika Anda paham teknis, Anda bisa menambahkan langsung ke file database lokal Anda, mengekspor file `database_LaguKustom.tsv`, lalu mengirimkannya lewat **Pull Request**.

## 3. Berkontribusi pada Kode (Code Contribution)
Jika Anda adalah seorang pengembang (Developer) dan ingin memperbaiki *bug* atau menambahkan fitur baru, ikuti panduan berikut:

### Persiapan Lokal (Local Setup)
1. **Fork** repositori ini ke akun GitHub Anda.
2. **Clone** repositori hasil fork tersebut ke komputer Anda:
   ```bash
   git clone https://github.com/USERNAME_ANDA/namarepo.git
   ```
3. Masuk ke folder aplikasi dan jalankan perintah install:
   ```bash
   cd namarepo/frontend
   npm install
   ```
4. Untuk menjalankan aplikasi di mode *development* (testing):
   ```bash
   npm run electron:dev
   ```

### Alur Kerja (Workflow)
1. Selalu buat *branch* baru dari cabang `desktop-app` (atau `main` jika disepakati) untuk setiap fitur atau perbaikan yang Anda kerjakan:
   ```bash
   git checkout -b fitur-keren-baru
   ```
2. Lakukan perubahan pada kode. Kami menggunakan stack: **React (Vite) + TailwindCSS + Electron**.
3. Pastikan kode Anda bisa di-build tanpa error:
   ```bash
   npm run build
   ```
4. *Commit* perubahan Anda dengan pesan yang jelas (misalnya: `feat: menambahkan fitur animasi slide`).
5. *Push* branch tersebut ke repositori fork Anda di GitHub:
   ```bash
   git push origin fitur-keren-baru
   ```
6. Buka repositori utama di GitHub, lalu klik tombol **Compare & pull request**.

### Standar Koding (Coding Standards)
- **Komponen React**: Usahakan memecah komponen UI yang besar menjadi komponen-komponen kecil (*Reusable Components*).
- **Styling**: Gunakan kelas bawaan dari TailwindCSS semaksimal mungkin sebelum menulis *custom CSS*.
- **Offline First**: Karena proyek ini difokuskan sebagai 100% *offline desktop app*, hindari penambahan fitur yang bergantung pada panggilan API internet yang memblokir proses (*blocking*), kecuali diberi *fallback* atau indikator *loading* yang jelas.

---

Dengan berkontribusi pada proyek ini, Anda setuju bahwa kode yang Anda sumbangkan akan dilisensikan di bawah lisensi Open Source proyek ini. 

**Tuhan Memberkati pelayanan kita bersama!**
