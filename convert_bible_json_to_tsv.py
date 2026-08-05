#!/usr/bin/env python3
"""
Converter: JSON Alkitab → TSV (BibleVerses format)
====================================================
Script ini mengkonversi file JSON dari format alkitab umum
(seperti AYT - Alkitab Yang Terbuka) ke dalam format TSV 
yang digunakan oleh aplikasi Worship Presenter.

Format JSON input:
  [{"id":"1","book":"1","abbr":"Kej","chapter":"1","verse":"1","text":"..."}]

Format TSV output:
  verseId\tbook\tchapter\tverse\ttext

Cara pakai:
  python3 convert_bible.py "ayt-Alkitab Yang Terbuka.json" AYT

Output:
  BibleVerses_AYT.tsv - siap di-copy ke frontend/public/data/
"""

import json
import sys
import os
import re

# Mapping abbr singkat → nama buku lengkap (Indonesia)
BOOK_NAMES = {
    "Kej": "Kejadian", "Kel": "Keluaran", "Im": "Imamat", "Bil": "Bilangan",
    "Ul": "Ulangan", "Yos": "Yosua", "Hak": "Hakim-Hakim", "Rut": "Rut",
    "1Sam": "1 Samuel", "2Sam": "2 Samuel", "1Raj": "1 Raja-Raja", "2Raj": "2 Raja-Raja",
    "1Taw": "1 Tawarikh", "2Taw": "2 Tawarikh", "Ezr": "Ezra", "Neh": "Nehemia",
    "Est": "Ester", "Ayb": "Ayub", "Mzm": "Mazmur", "Ams": "Amsal",
    "Pkh": "Pengkhotbah", "Kid": "Kidung Agung", "Yes": "Yesaya", "Yer": "Yeremia",
    "Rat": "Ratapan", "Yeh": "Yehezkiel", "Dan": "Daniel", "Hos": "Hosea",
    "Yoel": "Yoel", "Am": "Amos", "Ob": "Obaja", "Yun": "Yunus",
    "Mi": "Mikha", "Nah": "Nahum", "Hab": "Habakuk", "Zef": "Zefanya",
    "Hag": "Hagai", "Za": "Zakharia", "Mal": "Maleakhi",
    "Mat": "Matius", "Mrk": "Markus", "Luk": "Lukas", "Yoh": "Yohanes",
    "Kis": "Kisah Para Rasul", "Rm": "Roma", "1Kor": "1 Korintus", "2Kor": "2 Korintus",
    "Gal": "Galatia", "Ef": "Efesus", "Flp": "Filipi", "Kol": "Kolose",
    "1Tes": "1 Tesalonika", "2Tes": "2 Tesalonika", "1Tim": "1 Timotius",
    "2Tim": "2 Timotius", "Tit": "Titus", "Flm": "Filemon", "Ibr": "Ibrani",
    "Yak": "Yakobus", "1Ptr": "1 Petrus", "2Ptr": "2 Petrus",
    "1Yoh": "1 Yohanes", "2Yoh": "2 Yohanes", "3Yoh": "3 Yohanes",
    "Yud": "Yudas", "Why": "Wahyu"
}

def clean_text(text):
    """Bersihkan tag HTML seperti <t/> dari teks ayat."""
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('\n', ' ').replace('\t', ' ').strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def get_book_name(abbr, book_num=None):
    """Dapatkan nama buku lengkap dari singkatan."""
    if abbr in BOOK_NAMES:
        return BOOK_NAMES[abbr]
    # Fallback: kembalikan abbr apa adanya
    return abbr

def convert_json_to_tsv(json_file, version_code="AYT"):
    """Konversi file JSON Alkitab ke format TSV."""
    
    print(f"📖 Membaca file: {json_file}")
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not isinstance(data, list):
        print("❌ Format JSON tidak dikenali. Harus berupa array of objects.")
        return

    total = len(data)
    print(f"✅ Berhasil membaca {total} ayat")
    
    # Cek field yang tersedia
    sample = data[0]
    print(f"📋 Fields: {list(sample.keys())}")
    
    output_file = f"BibleVerses_{version_code}.tsv"
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("verseId\tbook\tchapter\tverse\ttext\n")
        
        for item in data:
            # Ambil field
            abbr = item.get('abbr', '')
            chapter = str(item.get('chapter', '1')).zfill(3)
            verse = str(item.get('verse', '1')).zfill(3)
            text_raw = item.get('text', '')
            
            # Bersihkan teks dari tag HTML
            text = clean_text(text_raw)
            
            # Dapatkan nama buku lengkap
            book_name = get_book_name(abbr)
            
            # Buat verseId: format B01_C001_V001
            book_num_raw = item.get('book', '1')
            try:
                book_num = str(int(book_num_raw)).zfill(2)
            except:
                book_num = '01'
            
            verse_id = f"B{book_num}_C{chapter}_V{verse}"
            
            out.write(f"{verse_id}\t{book_name}\t{int(chapter)}\t{int(verse)}\t{text}\n")
    
    print(f"\n✅ Berhasil! File tersimpan: {output_file}")
    print(f"   Total: {total} ayat")
    print(f"\n📌 Langkah selanjutnya untuk memasukkan ke aplikasi:")
    print(f"   1. Copy file ini:")
    print(f"      cp {output_file} frontend/public/data/BibleVerses.tsv")
    print(f"      cp {output_file} frontend/dist/data/BibleVerses.tsv")
    print(f"   2. Jalankan build:")
    print(f"      cd frontend && npm run build")
    print(f"   3. Jalankan script update:")
    print(f"      ./update_and_build.sh 'Ganti versi Alkitab ke {version_code}'")
    print(f"\n⚠️  PERINGATAN: File BibleVerses.tsv yang lama akan ditimpa!")
    print(f"   Backup dulu jika perlu: cp frontend/public/data/BibleVerses.tsv BibleVerses_backup.tsv")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        # Default: gunakan file AYT yang ada
        default_file = "frontend/scripts/ayt-Alkitab Yang Terbuka.json"
        version = "AYT"
        print(f"Menggunakan default: {default_file}")
        convert_json_to_tsv(default_file, version)
    else:
        json_file = sys.argv[1]
        version = sys.argv[2] if len(sys.argv) > 2 else "CUSTOM"
        convert_json_to_tsv(json_file, version)
