#!/bin/bash
# Script Otomatis Deploy WorshipPresenter
# Script ini akan melakukan commit semua perubahan di lokal, 
# mem-push kode utama ke branch "main",
# lalu secara khusus mem-push folder frontend/ ke branch "frontend-deploy" 
# agar Vercel/Netlify otomatis melakukan build ulang.

cd /home/sagala/pisgahbisdac/PB

echo "==============================================="
echo "1. Memeriksa dan menyimpan perubahan di lokal..."
echo "==============================================="
git checkout main
git add .
git commit -m "Auto deploy update: $(date +'%Y-%m-%d %H:%M:%S')" || echo "Tidak ada perubahan baru yang perlu disimpan"

echo ""
echo "==============================================="
echo "2. Push seluruh kode ke branch 'main'..."
echo "==============================================="
git push origin main

echo ""
echo "==============================================="
echo "3. Mengekstrak folder frontend dan mem-push ke 'frontend-deploy'..."
echo "==============================================="
# Menggunakan fitur subtree agar folder 'frontend' dikonversi menjadi root di branch frontend-deploy
git subtree push --prefix frontend origin frontend-deploy

echo ""
echo "==============================================="
echo "DEPLOY SELESAI!"
echo "Silakan periksa dashboard Vercel/Netlify Anda, build seharusnya sudah berjalan."
echo "==============================================="
