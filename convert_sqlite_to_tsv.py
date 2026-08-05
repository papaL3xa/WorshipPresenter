import sqlite3
import csv
import math

DB_PATH = 'frontend/scripts/kjv.sqlite3'
OUTPUT_TSV = 'frontend/scripts/BibleVerses_KJV.tsv'

def main():
    conn = sqlite3.connect(DB_PATH)
    
    # Get book mapping
    books = {}
    for row in conn.execute("SELECT osis, human, number FROM books"):
        books[row[0].strip()] = {
            'name': row[1].strip(),
            'number': int(row[2])
        }
    
    verses = []
    for row in conn.execute("SELECT book, verse, unformatted FROM verses"):
        book_osis = row[0].strip()
        verse_real = float(row[1])
        text = row[2].strip() if row[2] else ""
        
        chapter = int(math.floor(verse_real))
        verse_num = int(round((verse_real - chapter) * 1000))
        
        book_info = books.get(book_osis)
        if not book_info:
            print(f"Unknown book: {book_osis}")
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
        
    print(f"Writing {len(verses)} verses to {OUTPUT_TSV}...")
    with open(OUTPUT_TSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['verseId', 'book', 'chapter', 'verse', 'text'], delimiter='\t')
        writer.writeheader()
        writer.writerows(verses)
        
    print("Done! KJV SQLite3 converted successfully.")

if __name__ == '__main__':
    main()
