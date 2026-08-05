#!/usr/bin/env python3
"""
Script Scraper Lagu Sion - alkitab.app/LS
==========================================
Mengambil semua data lagu dari https://alkitab.app/LS (1 s/d 600)
lalu memperbarui file Songs.tsv dan SongSegments.tsv
dengan data terbaru termasuk Chorus/Reff yang mungkin hilang.

Cara pakai:
  python3 scrape_ls.py

Output:
  Songs_new.tsv        - File lagu terbaru (gabungan existing + dari web)
  SongSegments_new.tsv - File segmen terbaru (gabungan existing + dari web)
  scrape_report.txt    - Laporan: lagu mana yang diperbarui/ditambah
"""

import requests
from bs4 import BeautifulSoup
import time
import os
import re
import json

BASE_URL = "https://alkitab.app/LS/{}"
SONGS_TSV = "frontend/public/data/Songs.tsv"
SEGMENTS_TSV = "frontend/public/data/SongSegments.tsv"

def clean_text(text):
    """Bersihkan teks dari whitespace berlebihan."""
    return text.strip().replace('\n', ' ').replace('\r', '')

def scrape_song(song_num):
    """Scrape satu lagu dari alkitab.app/LS/{num}."""
    url = BASE_URL.format(song_num)
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
    except Exception as e:
        print(f"  ⚠️  Error fetching LS/{song_num}: {e}")
        return None

    soup = BeautifulSoup(resp.text, 'html.parser')
    lagu_div = soup.find('div', class_='lagu')
    if not lagu_div:
        return None

    # Ambil judul
    title_el = lagu_div.find(class_='judul')
    if not title_el:
        return None
    title = clean_text(title_el.get_text())

    # Ambil semua bait (bait atau reff/chorus)
    segments = []
    bait_divs = lagu_div.find_all('div', class_='bait')
    
    for bait in bait_divs:
        # Cek label bait
        bait_no_el = bait.find('div', class_='bait-no')
        bait_no_raw = clean_text(bait_no_el.get_text()) if bait_no_el else ''
        
        # Tentukan label: kalau isinya mengandung 'r' (reff) atau 'c' (chorus)
        label_raw = bait_no_raw.lower()
        if label_raw in ['r', 'reff', 'chorus', 'c', 'refrain']:
            label = 'Chorus'
        elif label_raw.isdigit():
            label = f'Bait {bait_no_raw}'
        else:
            label = bait_no_raw.capitalize() if bait_no_raw else 'Bait'

        # Ambil baris-baris teks
        bait_text_el = bait.find('div', class_='bait-text')
        lines = []
        if bait_text_el:
            for baris in bait_text_el.find_all('div', class_='baris'):
                lines.append(clean_text(baris.get_text()))
        
        text = ' \\n'.join(lines)
        if text:
            segments.append({'label': label, 'text': text})

    if not segments:
        return None

    return {
        'number': song_num,
        'title': title,
        'segments': segments
    }

def load_existing_songs(filepath):
    """Baca Songs.tsv yang ada."""
    songs = {}
    if not os.path.exists(filepath):
        return songs
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    header = lines[0].strip().split('\t')
    for line in lines[1:]:
        parts = line.strip().split('\t')
        if len(parts) >= 2:
            song_id = parts[0]
            songs[song_id] = dict(zip(header, parts))
    return songs

def load_existing_segments(filepath):
    """Baca SongSegments.tsv yang ada."""
    segments = {}
    if not os.path.exists(filepath):
        return segments
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    header = lines[0].strip().split('\t')
    for line in lines[1:]:
        parts = line.strip().split('\t')
        if len(parts) >= 2:
            seg_id = parts[0]
            segments[seg_id] = dict(zip(header, parts))
    return segments

def main():
    print("=" * 60)
    print("SCRAPER LAGU SION - alkitab.app/LS")
    print("=" * 60)

    existing_songs = load_existing_songs(SONGS_TSV)
    existing_segments = load_existing_segments(SEGMENTS_TSV)

    print(f"📂 Data existing: {len(existing_songs)} lagu, {len(existing_segments)} segmen")

    report = []
    new_songs = {}
    new_segments = {}

    # Coba scrape dari nomor 1 sampai 600
    max_song = 600
    not_found_streak = 0

    for num in range(1, max_song + 1):
        song_id = f"LSEB_{num}"
        
        print(f"  Scraping LS/{num}...", end=" ", flush=True)
        data = scrape_song(num)

        if data is None:
            not_found_streak += 1
            print("❌ Tidak ditemukan")
            if not_found_streak >= 10:
                print(f"\n  ℹ️  10 lagu berturut-turut tidak ada, berhenti di LS/{num}")
                break
            continue
        
        not_found_streak = 0
        title = f"{num}. {data['title'].title()}"
        segments = data['segments']
        
        # Hitung segment order
        seg_order = list(range(len(segments)))
        seg_order_str = json.dumps(seg_order)
        
        # Check if song exists and has same number of segments
        existing_song = existing_songs.get(song_id)
        seg_count_old = 0
        if existing_song:
            try:
                seg_order_old = json.loads(existing_song.get('segmentOrder', '[]'))
                seg_count_old = len(seg_order_old)
            except:
                pass
        
        status = "NEW" if not existing_song else ("UPDATED" if len(segments) != seg_count_old else "SAME")
        print(f"✅ {title[:40]} ({len(segments)} segmen) [{status}]")
        
        if status != "SAME":
            report.append(f"LS/{num}: {title} - {status} ({seg_count_old} → {len(segments)} segmen)")

        # Masukkan ke new_songs
        author = existing_song.get('author', '') if existing_song else ''
        category = existing_song.get('category', 'Lagu Sion') if existing_song else 'Lagu Sion'
        new_songs[song_id] = {
            'songId': song_id,
            'title': title,
            'author': author,
            'category': category,
            'segmentOrder': seg_order_str
        }

        # Masukkan ke new_segments
        for i, seg in enumerate(segments):
            seg_id = f"{song_id}_s{i}"
            new_segments[seg_id] = {
                'segmentId': seg_id,
                'songId': song_id,
                'label': seg['label'],
                'text': seg['text'],
                'order': str(i + 1)
            }

        # Rate limit
        time.sleep(0.3)

    # Tulis Songs_new.tsv
    songs_header = ['songId', 'title', 'author', 'category', 'segmentOrder']
    out_songs = "Songs_new.tsv"
    with open(out_songs, 'w', encoding='utf-8') as f:
        f.write('\t'.join(songs_header) + '\n')
        for song in sorted(new_songs.values(), key=lambda x: int(x['songId'].split('_')[1])):
            row = [song.get(h, '') for h in songs_header]
            f.write('\t'.join(row) + '\n')
    print(f"\n✅ Berhasil menulis {out_songs} ({len(new_songs)} lagu)")

    # Tulis SongSegments_new.tsv
    segs_header = ['segmentId', 'songId', 'label', 'text', 'order']
    out_segs = "SongSegments_new.tsv"
    with open(out_segs, 'w', encoding='utf-8') as f:
        f.write('\t'.join(segs_header) + '\n')
        for seg in new_segments.values():
            row = [seg.get(h, '') for h in segs_header]
            f.write('\t'.join(row) + '\n')
    print(f"✅ Berhasil menulis {out_segs} ({len(new_segments)} segmen)")

    # Tulis laporan
    with open("scrape_report.txt", 'w', encoding='utf-8') as f:
        f.write("LAPORAN SCRAPING LAGU SION\n")
        f.write("=" * 50 + "\n")
        f.write(f"Total lagu: {len(new_songs)}\n")
        f.write(f"Total segmen: {len(new_segments)}\n")
        f.write(f"\nLagu yang berubah/baru:\n")
        for r in report:
            f.write(f"  - {r}\n")
    
    print(f"\n📋 Laporan disimpan di scrape_report.txt")
    print(f"   {len(report)} lagu yang berubah")
    print("\n" + "=" * 60)
    print("SELESAI! Langkah selanjutnya:")
    print("  cp Songs_new.tsv frontend/public/data/Songs.tsv")
    print("  cp SongSegments_new.tsv frontend/public/data/SongSegments.tsv")
    print("  cp Songs_new.tsv frontend/dist/data/Songs.tsv")
    print("  cp SongSegments_new.tsv frontend/dist/data/SongSegments.tsv")
    print("=" * 60)

if __name__ == '__main__':
    main()
