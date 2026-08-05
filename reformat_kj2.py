import csv
import sys
import os

def reformat_kj(input_filename, output_filename):
    if not os.path.exists(input_filename):
        print(f"Skipping {input_filename} because it doesn't exist.")
        return
        
    print(f"Reformatting {input_filename} -> {output_filename}")
    
    with open(input_filename, 'r', encoding='utf-8') as f_in:
        reader = csv.DictReader(f_in, delimiter='\t')
        all_rows = list(reader)
        max_segments = 0
        
        for row in all_rows:
            lyrics = row.get('lyrics', '')
            segments = [s.strip() for s in lyrics.split('\n\n') if s.strip()]
            max_segments = max(max_segments, len(segments))
            
        headers = ['songId', 'title', 'author', 'category']
        for i in range(1, max_segments + 1):
            headers.append(f'segment{i}')
            
        with open(output_filename, 'w', encoding='utf-8', newline='') as f_out:
            writer = csv.writer(f_out, delimiter='\t', quotechar='"', quoting=csv.QUOTE_ALL)
            writer.writerow(headers)
            
            for row in all_rows:
                song_id = row.get('id', '')
                title = row.get('title', '')
                author = row.get('author', 'Kidung Jemaat')
                category = row.get('category', 'Kidung Jemaat')
                lyrics = row.get('lyrics', '')
                
                num_part = song_id.replace('KJ_', '')
                if not title.startswith(f"{num_part}."):
                    title = f"{num_part}. {title}"
                
                segments = [s.strip() for s in lyrics.split('\n\n') if s.strip()]
                out_row = [song_id, title, author, category]
                for seg in segments:
                    out_row.append(seg)
                    
                # No padding to max_segments!
                writer.writerow(out_row)

if __name__ == "__main__":
    reformat_kj("Kidung_Jemaat.tsv", "Kidung_Jemaat_Import.tsv")
    print("Done formatting Kidung Jemaat without padding!")
