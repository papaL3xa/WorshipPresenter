#!/bin/bash
# Script untuk membuat versi Aplikasi Desktop (Offline)

echo "==================================================="
echo "🚀 Memulai proses build Aplikasi Desktop (Offline)"
echo "==================================================="

# Pindah ke direktori frontend
cd frontend || { echo "Gagal menemukan folder frontend"; exit 1; }

# Menjalankan perintah build Electron
echo "Sedang mengompilasi kode dan mengemas aplikasi..."
npm run electron:build

if [ $? -eq 0 ]; then
    echo "==================================================="
    echo "✅ PROSES SELESAI!"
    echo "Aplikasi Anda berhasil di-update."
    echo "Silakan salin folder hasil build di:"
    echo "$(pwd)/release/WorshipPresenter-win32-x64/"
    echo "==================================================="
else
    echo "==================================================="
    echo "❌ PROSES GAGAL!"
    echo "Terjadi kesalahan saat mem-build aplikasi."
    echo "==================================================="
fi
