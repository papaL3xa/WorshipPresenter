import fs from 'fs';

async function run() {
  console.log("Mengunduh data Lagu Sion Edisi Baru...");
  const res = await fetch("https://play.lagusion.org/assets/songs_4.json");
  const data = await res.json();
  
  // Menggunakan format TSV (Tab Separated) agar lebih mudah dan akurat saat di-copy paste ke Google Sheets
  // karena lirik seringkali mengandung koma (,) yang bisa merusak format CSV.
  let songsCsv = "songId\ttitle\tauthor\tcategory\tsegmentOrder\n";
  let segmentsCsv = "segmentId\tsongId\tlabel\ttext\torder\n";
  
  console.log("Memproses JSON...");
  for (const key in data) {
    const song = data[key];
    const sId = "LSEB_" + song.id;
    const author = song.artist || "";
    // Membuat format judul yang rapi (misal: "1. Di Hadapan Hadirat-Mu")
    const title = `${song.sort}. ${song.title}`;
    
    let segOrderArr = [];
    
    if (song.verse && Array.isArray(song.verse)) {
      let chorusText = null;
      let verses = [];
      
      // Tahap 1: Ekstrak semua bait dan cari teks Refrain
      song.verse.forEach((v) => {
        const label = v.part ? v.part : `Bait ${v.verse}`;
        let text = v.lyrics.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ''); 
        
        // Cari keberadaan "Ref:" atau "Koor:" (case insensitive)
        const refMatch = text.match(/(?:\s*(?:Ref|Koor)\s*:\s*)(.*)/i);
        if (refMatch) {
            chorusText = refMatch[1].trim();
            text = text.replace(refMatch[0], '').trim();
        }
        
        verses.push({ label, text });
      });
      
      // Tahap 2: Tulis ke TSV. Jika ada Chorus, sisipkan setelah setiap Bait
      let segIdx = 0;
      verses.forEach((v) => {
         const segId = `${sId}_s${segIdx}`;
         segmentsCsv += `${segId}\t${sId}\t${v.label}\t${v.text}\t${segIdx + 1}\n`;
         segOrderArr.push(segIdx);
         segIdx++;
         
         if (chorusText) {
             const chorusId = `${sId}_s${segIdx}`;
             segmentsCsv += `${chorusId}\t${sId}\tChorus\t${chorusText}\t${segIdx + 1}\n`;
             segOrderArr.push(segIdx);
             segIdx++;
         }
      });
    }
    
    songsCsv += `${sId}\t${title}\t${author}\tLagu Sion\t${JSON.stringify(segOrderArr)}\n`;
  }
  
  fs.writeFileSync('Songs.tsv', songsCsv);
  fs.writeFileSync('SongSegments.tsv', segmentsCsv);
  console.log("✅ Berhasil! File 'Songs.tsv' dan 'SongSegments.tsv' telah dibuat di folder frontend.");
}

run();
