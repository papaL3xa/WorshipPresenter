#!/usr/bin/env python3
"""
convert_sdah.py
===============
Mengonversi file SDAH.sps (format SoftProjector) 
menjadi file TSV flat (format Kidung Jemaat) 
yang langsung bisa diimport ke Worship Presenter.

Cara pakai:
  python3 convert_sdah.py SDAH.sps SDAH_Hymnal.tsv
  atau jalankan tanpa argumen untuk download otomatis:
  python3 convert_sdah.py
"""

import sys
import csv
import urllib.request

SPS_URL = "https://raw.githubusercontent.com/iCodeOkay/SoftProjector-SDAH/master/SDAH.sps"
DB_NAME = "SDA Hymnal (SDAH)"

def download_sps(url: str) -> str:
    print(f"Mengunduh {url} ...")
    with urllib.request.urlopen(url) as resp:
        return resp.read().decode("utf-8-sig")

def parse_sps(content: str) -> list[dict]:
    """
    Format setiap baris .sps:
    nomor #$# Judul #$# kategori #$# ? #$# penulis_lirik #$# penulis_melodi #$# konten #$# ? #$# align #$# 

    Konten:
      @$ = pemisah bait/segmen
      @% = pemisah baris dalam bait

    Baris pertama yang dimulai dengan ## adalah metadata (header file).
    """
    songs = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("##"):
            continue

        parts = line.split("#$#")
        if len(parts) < 7:
            continue

        number      = parts[0].strip()
        title       = parts[1].strip()
        # parts[2] = kategori internal (biasanya '0')
        # parts[3] = kosong
        lyricist    = parts[4].strip()
        composer    = parts[5].strip()
        raw_content = parts[6].strip()

        if not title:
            continue

        # Pisahkan bait berdasarkan @$
        raw_segments = [s.strip() for s in raw_content.split("@$") if s.strip()]

        segments = []
        seg_labels = []
        for seg in raw_segments:
            # Baris pertama = label bait (mis. "Verse 1", "Refrain")
            lines = seg.split("@%")
            label = lines[0].strip() if lines else ""
            body_lines = [l.strip() for l in lines[1:] if l.strip()]
            body = "\n".join(body_lines)

            if not body:
                # Jika bait hanya punya label tanpa isi, skip
                continue

            seg_labels.append(label)
            segments.append(body)

        if not segments:
            continue

        author_combined = lyricist
        if composer and composer != lyricist:
            if author_combined:
                author_combined += f"; {composer}"
            else:
                author_combined = composer

        songs.append({
            "number":   number,
            "title":    f"{number}. {title}",
            "author":   author_combined,
            "segments": segments,
            "labels":   seg_labels,
        })

    return songs


def write_tsv(songs: list[dict], out_path: str):
    """
    Format output TSV (flat) seperti Kidung_Jemaat.tsv:
    songId | title | author | category | segment1 | segment2 | ...
    """
    # Hitung jumlah segmen maksimal agar header seragam
    max_segs = max((len(s["segments"]) for s in songs), default=1)

    headers = ["songId", "title", "author", "category"] + [f"segment{i+1}" for i in range(max_segs)]

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t", quoting=csv.QUOTE_ALL)
        writer.writerow(headers)

        for song in songs:
            segs = song["segments"]
            row = [
                f"SDAH_{song['number']}",
                song["title"],
                song["author"],
                DB_NAME,
            ]
            # Isi segmen, sisa diisi string kosong
            for i in range(max_segs):
                row.append(segs[i] if i < len(segs) else "")
            writer.writerow(row)

    print(f"✅  Selesai! {len(songs)} lagu ditulis ke: {out_path}")
    print(f"   Segmen terbanyak per lagu: {max_segs}")


def main():
    if len(sys.argv) >= 3:
        sps_path = sys.argv[1]
        out_path = sys.argv[2]
        print(f"Membaca file: {sps_path}")
        with open(sps_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
    elif len(sys.argv) == 2:
        out_path = sys.argv[1]
        content = download_sps(SPS_URL)
    else:
        out_path = "SDAH_Hymnal.tsv"
        content = download_sps(SPS_URL)

    songs = parse_sps(content)
    print(f"   Berhasil mem-parsing {len(songs)} lagu dari file .sps")
    write_tsv(songs, out_path)


if __name__ == "__main__":
    main()
