#!/bin/bash
# ============================================================
# Script: add_bible.sh
# Fungsi: Mengkonversi file JSON Alkitab ke TSV dan menerapkannya
#         langsung ke dalam aplikasi Worship Presenter.
#
# Cara Pakai:
#   ./add_bible.sh [file_json] [kode_versi]
#
# Contoh:
#   ./add_bible.sh "frontend/scripts/ayt-Alkitab Yang Terbuka.json" AYT
#   ./add_bible.sh "frontend/scripts/tb-Terjemahan Baru.json" TB
#   ./add_bible.sh "frontend/scripts/bimk-BIMK.json" BIMK
#
# Format JSON yang didukung:
#   [{"book":"1","abbr":"Kej","chapter":"1","verse":"1","text":"..."}]
# ============================================================

cd "$(dirname "$0")"

echo "==================================================="
echo "  KONVERTER & INSTALLER VERSI ALKITAB"
echo "==================================================="

# --- Validasi Argumen ---
if [ -z "$1" ]; then
    echo ""
    echo "❓ Tidak ada file JSON yang diberikan."
    echo ""
    echo "Cara pakai:"
    echo "  ./add_bible.sh [file_json] [kode_versi]"
    echo ""
    echo "Contoh:"
    echo "  ./add_bible.sh \"frontend/scripts/ayt-Alkitab Yang Terbuka.json\" AYT"
    echo ""
    echo "File JSON yang tersedia di folder scripts:"
    ls frontend/scripts/*.json 2>/dev/null || echo "  (tidak ada file JSON)"
    exit 1
fi

JSON_FILE="$1"
VERSION_CODE="${2:-CUSTOM}"

if [ ! -f "$JSON_FILE" ]; then
    echo "❌ File tidak ditemukan: $JSON_FILE"
    exit 1
fi

echo ""
echo "📖 File    : $JSON_FILE"
echo "📌 Versi   : $VERSION_CODE"
echo ""

# --- Step 1: Backup versi Alkitab yang lama ---
echo "==================================================="
echo "1. BACKUP ALKITAB LAMA"
echo "==================================================="
BACKUP_FILE="BibleVerses_backup_$(date +'%Y%m%d_%H%M%S').tsv"
if [ -f "frontend/public/data/BibleVerses.tsv" ]; then
    cp "frontend/public/data/BibleVerses.tsv" "$BACKUP_FILE"
    echo "✅ Backup disimpan: $BACKUP_FILE"
else
    echo "ℹ️  Tidak ada file lama untuk di-backup."
fi

# --- Step 2: Konversi JSON → TSV ---
echo ""
echo "==================================================="
echo "2. KONVERSI JSON → TSV"
echo "==================================================="

python3 convert_bible.py "$JSON_FILE" "$VERSION_CODE"

TSV_OUTPUT="BibleVerses_${VERSION_CODE}.tsv"

if [ ! -f "$TSV_OUTPUT" ]; then
    echo "❌ Konversi gagal! File output tidak ditemukan: $TSV_OUTPUT"
    exit 1
fi

echo "✅ Konversi selesai: $TSV_OUTPUT"

# --- Step 3: Salin ke folder data aplikasi ---
echo ""
echo "==================================================="
echo "3. MENERAPKAN KE APLIKASI"
echo "==================================================="

cp "$TSV_OUTPUT" "frontend/public/data/BibleVerses.tsv"
echo "✅ Diterapkan ke: frontend/public/data/BibleVerses.tsv"

cp "$TSV_OUTPUT" "frontend/dist/data/BibleVerses.tsv"
echo "✅ Diterapkan ke: frontend/dist/data/BibleVerses.tsv"

# Juga update di release jika ada
if [ -d "frontend/release/WorshipPresenter-win32-x64/resources/app/dist/data/" ]; then
    cp "$TSV_OUTPUT" "frontend/release/WorshipPresenter-win32-x64/resources/app/dist/data/BibleVerses.tsv"
    echo "✅ Diterapkan ke: release/WorshipPresenter.../dist/data/BibleVerses.tsv"
fi

# --- Step 4: Build dan push ke GitHub ---
echo ""
echo "==================================================="
echo "4. BUILD & PUSH KE GITHUB"
echo "==================================================="

cd frontend || { echo "❌ Folder frontend tidak ditemukan!"; exit 1; }

echo "Sedang build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build gagal! Cek error di atas."
    exit 1
fi

echo "✅ Build berhasil!"
cd ..

echo "Menyimpan ke GitHub..."
git add .
git commit -m "feat: ganti/tambah versi Alkitab ${VERSION_CODE} - $(date +'%Y-%m-%d %H:%M:%S')"
git push origin HEAD

# --- Selesai ---
echo ""
echo "==================================================="
echo "✅ SELESAI! Alkitab versi ${VERSION_CODE} berhasil diterapkan."
echo ""
echo "Untuk melihat hasilnya:"
echo "  1. Tutup aplikasi WorshipPresenter yang sedang berjalan"
echo "  2. Jalankan: ./update_and_build.sh 'Alkitab ${VERSION_CODE}'"  
echo "  3. Buka aplikasi baru dan coba cari ayat Alkitab"
echo "==================================================="
