import csv
import sys

def check_tsv(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter='\t')
            for i, row in enumerate(reader):
                pass
            print(f"Success! Parsed {i+1} rows.")
    except Exception as e:
        print(f"Error at row {i+1}: {e}")

if __name__ == '__main__':
    check_tsv('/home/sagala/pisgahbisdac/PB/frontend/public/data/BibleVerses_TB.tsv')
