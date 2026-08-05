#!/bin/bash
# ============================================================
# Script: convert_sqlite.sh
# Fungsi: Mengkonversi file SQLite3 Alkitab ke format TSV
# ============================================================

cd "$(dirname "$0")"

echo "==================================================="
echo "  KONVERTER ALKITAB SQLITE3 -> TSV"
echo "==================================================="

if [ -z "$1" ]; then
    echo ""
    echo "❓ Penggunaan salah."
    echo ""
    echo "Cara pakai:"
    echo "  ./convert_sqlite.sh [file_sqlite3] [KODE_VERSI]"
    echo ""
    echo "Contoh:"
    echo "  ./convert_sqlite.sh \"frontend/scripts/BatakToba.sqlite3\" TOBA"
    echo ""
    exit 1
fi

SQLITE_FILE="$1"
VERSION_CODE="${2:-BARU}"

if [ ! -f "$SQLITE_FILE" ]; then
    echo "❌ File tidak ditemukan: $SQLITE_FILE"
    exit 1
fi

OUTPUT_TSV="frontend/scripts/BibleVerses_${VERSION_CODE}.tsv"

# Buat script python sementara untuk melakukan ekstraksi
cat << 'EOF' > temp_convert.py
import sqlite3
import csv
import math
import sys

DB_PATH = sys.argv[1]
OUTPUT_TSV = sys.argv[2]

def main():
    conn = sqlite3.connect(DB_PATH)
    
    # Ambil pemetaan buku
    books = {}
    try:
        for row in conn.execute("SELECT osis, human, number FROM books"):
            books[row[0].strip()] = {
                'name': row[1].strip(),
                'number': int(row[2])
            }
    except Exception as e:
        print("Format SQLite tidak didukung atau tabel books tidak ditemukan.")
        sys.exit(1)
    
    verses = []
    for row in conn.execute("SELECT book, verse, unformatted FROM verses"):
        book_osis = row[0].strip()
        verse_real = float(row[1])
        text = row[2].strip() if row[2] else ""
        
        chapter = int(math.floor(verse_real))
        verse_num = int(round((verse_real - chapter) * 1000))
        
        book_info = books.get(book_osis)
        if not book_info:
            continue
            
        book_name = book_info['name']
        book_num = str(book_info['number']).zfill(2)
        chap_str = str(chapter).zfill(3)
        verse_str = str(verse_num).zfill(3)
        
        verseId = f"B{book_num}_C{chap_str}_V{verse_str}"
        
        verses.append({
            'verseId': verseId,
            'book': book_name,
            'chapter': chapter,
            'verse': verse_num,
            'text': text
        })
        
    print(f"Mengekstrak {len(verses)} ayat ke {OUTPUT_TSV}...")
    with open(OUTPUT_TSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['verseId', 'book', 'chapter', 'verse', 'text'], delimiter='\t')
        writer.writeheader()
        writer.writerows(verses)
        
    print("Selesai!")

if __name__ == '__main__':
    main()
EOF

echo "Memproses file: $SQLITE_FILE"
python3 temp_convert.py "$SQLITE_FILE" "$OUTPUT_TSV"

if [ $? -eq 0 ]; then
    echo "✅ Berhasil! File TSV telah dibuat: $OUTPUT_TSV"
    echo ""
    echo "Langkah selanjutnya:"
    echo "1. Pindahkan $OUTPUT_TSV ke folder frontend/public/data/"
    echo "2. Daftarkan versinya di frontend/src/utils/dbStorage.ts"
    echo "3. Naikkan nomor versi (currentDbVersion) di dbStorage.ts"
    echo "4. Jalankan ./build_installer.sh untuk mem-build ulang aplikasi."
else
    echo "❌ Konversi gagal."
fi

# Hapus file python sementara
rm -f temp_convert.py
