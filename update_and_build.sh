#!/bin/bash
# Script Otomatis: Push ke GitHub & Build Aplikasi Desktop
# ---------------------------------------------------------

# Memastikan script dijalankan dari folder root proyek
cd "$(dirname "$0")"

echo "==================================================="
echo "1. MENYIMPAN PERUBAHAN KE GITHUB"
echo "==================================================="

# Memeriksa status git
git status -s

echo "Menambahkan semua perubahan..."
git add .

# Jika ada argument pesan commit, gunakan itu. Jika tidak, gunakan pesan default waktu.
COMMIT_MSG="Update Desktop App: $(date +'%Y-%m-%d %H:%M:%S')"
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
fi

echo "Melakukan commit: $COMMIT_MSG"
git commit -m "$COMMIT_MSG" || echo "Tidak ada perubahan baru untuk di-commit."

echo "Mendorong (Push) ke GitHub (branch desktop-app)..."
# Menggunakan origin HEAD agar selalu push ke branch saat ini
git push origin HEAD

echo ""
echo "==================================================="
echo "2. MEMBUAT APLIKASI DESKTOP (.exe)"
echo "==================================================="

cd frontend || { echo "Gagal menemukan folder frontend!"; exit 1; }

echo "Sedang mengompilasi kode dan mengemas aplikasi..."
npm run electron:build

if [ $? -eq 0 ]; then
    echo "==================================================="
    echo "✅ PROSES SELESAI DENGAN SUKSES!"
    echo "Kode Anda telah diamankan di GitHub."
    echo "Aplikasi (.exe) terbaru telah dibuat dan berada di:"
    echo "$(pwd)/release/WorshipPresenter-win32-x64/"
    echo "==================================================="
else
    echo "==================================================="
    echo "❌ PROSES BUILD GAGAL!"
    echo "Terjadi kesalahan saat membuat aplikasi (.exe)."
    echo "==================================================="
fi
