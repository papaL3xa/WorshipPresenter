#!/bin/bash
# Script Otomatis Deploy ke GitHub Pages (WorshipPresenter)
# Script ini akan melakukan commit semua perubahan di lokal, 
# mem-push ke branch "main", dan mendeploy frontend ke branch "gh-pages"

cd /home/sagala/pisgahbisdac/PB

echo "==============================================="
echo "1. Memeriksa dan menyimpan perubahan di lokal..."
echo "==============================================="
git checkout main
git add .
git commit -m "Auto deploy update: $(date +'%Y-%m-%d %H:%M:%S')" || echo "Tidak ada perubahan baru yang perlu disimpan"

echo ""
echo "==============================================="
echo "2. Push seluruh kode ke GitHub..."
echo "==============================================="
git push origin main

echo ""
echo "==============================================="
echo "3. Melakukan build dan deploy ke GitHub Pages..."
echo "==============================================="
cd frontend
npm run deploy

echo ""
echo "==============================================="
echo "DEPLOY SELESAI!"
echo "Perubahan akan muncul di https://papal3xa.github.io/WorshipPresenter/ dalam 1-2 menit."
echo "==============================================="
