#!/bin/bash
# Script Otomatis: Membuat File Installer (.exe Setup)
# ---------------------------------------------------------
# Gunakan script ini untuk membuat versi INSTALLER yang bisa
# diinstal langsung ke dalam komputer Windows pengguna.
# Hasilnya berupa file: "Worship Presenter Setup X.X.X.exe"
#
# Perbedaan dengan update_and_build.sh:
# - update_and_build.sh  → Aplikasi portable (folder .zip / langsung jalan)
# - build_installer.sh   → File installer .exe (diinstall ke Program Files)
# ---------------------------------------------------------

cd "$(dirname "$0")"

echo "==================================================="
echo "1. MENYIMPAN PERUBAHAN KE GITHUB"
echo "==================================================="

git status -s
git add .

COMMIT_MSG="Build Installer: $(date +'%Y-%m-%d %H:%M:%S')"
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
fi

git commit -m "$COMMIT_MSG" || echo "Tidak ada perubahan baru untuk di-commit."
git push origin HEAD

echo ""
echo "==================================================="
echo "2. MEMBUAT FILE INSTALLER (.exe Setup)"
echo "==================================================="

cd frontend || { echo "Gagal menemukan folder frontend!"; exit 1; }

echo "Sedang mengompilasi kode..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build kode GAGAL! Cek error di atas."
    exit 1
fi

echo "Sedang mengemas menjadi file Installer (.exe)..."
npx electron-builder --win --x64

if [ $? -eq 0 ]; then
    echo "Membersihkan file-file sementara..."
    mkdir -p release
    # Pindahkan file .exe ke folder release
    mv release-installer/*.exe release/ 2>/dev/null
    # Hapus folder release-installer yang berisi file rongsokan (win-unpacked dll)
    rm -rf release-installer

    echo "==================================================="
    echo "✅ INSTALLER BERHASIL DIBUAT!"
    echo "Hanya File Installer yang disimpan di:"
    echo "$(pwd)/release/"
    echo ""
    echo "Cari file bernama: 'Worship Presenter Setup *.exe'"
    echo "Kirimkan file tersebut ke pengguna untuk diinstall."
    echo "==================================================="
else
    echo "==================================================="
    echo "❌ PROSES BUILD INSTALLER GAGAL!"
    echo "Terjadi kesalahan. Cek error di atas."
    echo "==================================================="
fi
