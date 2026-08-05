#!/usr/bin/env python3
import csv

BIBLE_BOOKS = [
  "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan",
  "Yosua", "Hakim-hakim", "Rut", "1 Samuel", "2 Samuel",
  "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh", "Ezra",
  "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal",
  "Pengkhotbah", "Kidung Agung", "Yesaya", "Yeremia", "Ratapan",
  "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos",
  "Obaja", "Yunus", "Mikha", "Nahum", "Habakuk",
  "Zefanya", "Hagai", "Zakharia", "Maleakhi",
  "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul",
  "Roma", "1 Korintus", "2 Korintus", "Galatia", "Efesus",
  "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius",
  "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus",
  "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes", "3 Yohanes",
  "Yudas", "Wahyu"
]

PATHS = [
    "frontend/scripts/BibleVerses_KJV.tsv",
    "frontend/public/data/BibleVerses_KJV.tsv"
]

def process_file(path):
    print(f"Processing {path}...")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='\t')
            rows = list(reader)
            fieldnames = reader.fieldnames
            
        for row in rows:
            vid = row['verseId']
            # vid format: B01_C001_V001
            b_str = vid.split('_')[0][1:] # '01'
            b_idx = int(b_str) - 1
            if 0 <= b_idx < len(BIBLE_BOOKS):
                row['book'] = BIBLE_BOOKS[b_idx]
                
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
            writer.writeheader()
            writer.writerows(rows)
            
        print(f"Successfully processed {path}")
    except Exception as e:
        print(f"Error processing {path}: {e}")

if __name__ == '__main__':
    for p in PATHS:
        process_file(p)
