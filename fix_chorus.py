#!/usr/bin/env python3
import csv
import json
import os

SONGS_PATH = "frontend/public/data/Songs.tsv"
SEGMENTS_PATH = "frontend/public/data/SongSegments.tsv"

def main():
    # 1. Read segments
    segments = []
    with open(SEGMENTS_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            segments.append(row)

    # Group segments by songId
    song_segs = {}
    for seg in segments:
        sid = seg['songId']
        if sid not in song_segs:
            song_segs[sid] = []
        song_segs[sid].append(seg)

    # 2. Process segments and identify chorus
    chorus_map = {}
    for sid, segs in song_segs.items():
        # Identify chorus segment
        chorus_idx = -1
        # Try finding explicit 'Chorus' or 'Refrain'
        for i, seg in enumerate(segs):
            label = seg['label'].lower().strip()
            if label in ['chorus', 'refrain', 'reff']:
                chorus_idx = i
                seg['label'] = 'Chorus' # Normalize
                break
        
        # Fallback: find 'Bait' (no number) that is at index 1 (after Bait 1)
        if chorus_idx == -1 and len(segs) > 1:
            if segs[1]['label'].strip().lower() == 'bait':
                chorus_idx = 1
                segs[1]['label'] = 'Chorus' # Rename it!
        
        if chorus_idx != -1:
            chorus_map[sid] = chorus_idx

    # Write back the segments (some labels might have changed to 'Chorus')
    with open(SEGMENTS_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['segmentId', 'songId', 'label', 'text', 'order'], delimiter='\t')
        writer.writeheader()
        writer.writerows(segments)

    # 3. Read Songs and modify segmentOrder
    songs = []
    with open(SONGS_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            songs.append(row)

    for song in songs:
        sid = song['songId']
        if sid in chorus_map:
            chorus_idx = chorus_map[sid]
            segs = song_segs[sid]
            new_order = []
            
            # Rebuild order
            for i, seg in enumerate(segs):
                if i == chorus_idx:
                    # If chorus is the very first segment (index 0), add it at the start
                    if i == 0:
                        new_order.append(i)
                    continue # otherwise, skip it here, we add it after verses
                
                # Add the verse
                new_order.append(i)
                # Add the chorus after the verse
                new_order.append(chorus_idx)
            
            song['segmentOrder'] = json.dumps(new_order)

    # Write back the songs
    with open(SONGS_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['songId', 'title', 'author', 'category', 'segmentOrder'], delimiter='\t')
        writer.writeheader()
        writer.writerows(songs)

    print(f"Fixed {len(chorus_map)} songs to repeat chorus after each verse!")

if __name__ == '__main__':
    main()
