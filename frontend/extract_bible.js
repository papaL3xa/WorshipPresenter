import fs from 'fs';

const BIBLE_BOOKS = [
  "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan", "Yosua", "Hakim-hakim", "Rut", 
  "1 Samuel", "2 Samuel", "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh", "Ezra", 
  "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal", "Pengkhotbah", "Kidung Agung", "Yesaya", 
  "Yeremia", "Ratapan", "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja", "Yunus", 
  "Mikha", "Nahum", "Habakuk", "Zefanya", "Hagai", "Zakharia", "Maleakhi", 
  "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "2 Korintus", 
  "Galatia", "Efesus", "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius", "2 Timotius", 
  "Titus", "Filemon", "Ibrani", "Yakobus", "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes", 
  "3 Yohanes", "Yudas", "Wahyu"
];

async function run() {
  console.log("Mengunduh data Alkitab (TB)... mohon tunggu...");
  const res = await fetch("https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Indonesian/bible.json");
  const data = await res.json();
  
  let tsvData = "verseId\tbook\tchapter\tverse\ttext\n";
  let count = 0;
  
  console.log("Memproses data...");
  const books = data.Book;
  
  if (books.length !== 66) {
    console.log("Peringatan: Jumlah kitab tidak sama dengan 66 (terdeteksi " + books.length + ")");
  }
  
  books.forEach((bookObj, bookIndex) => {
    const bookName = BIBLE_BOOKS[bookIndex];
    if (!bookName) return; // Skip if index out of bounds
    
    // Formatting Book Index to 2 digits (e.g. 01 for Kejadian)
    const bId = String(bookIndex + 1).padStart(2, '0');
    
    const chapters = bookObj.Chapter;
    chapters.forEach((chapterObj, chapterIndex) => {
      const chapNum = chapterIndex + 1;
      const cId = String(chapNum).padStart(3, '0');
      
      const verses = chapterObj.Verse;
      verses.forEach((verseObj, verseIndex) => {
        const verseNum = verseIndex + 1;
        const vId = String(verseNum).padStart(3, '0');
        
        const verseId = `B${bId}_C${cId}_V${vId}`; // e.g. B01_C001_V001
        
        // Membersihkan quote di belakang ayat (kadang json ini ada extra quote di ujung)
        let text = verseObj.Verse.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
        if (text.endsWith('"')) {
            text = text.slice(0, -1);
        }
        
        tsvData += `${verseId}\t${bookName}\t${chapNum}\t${verseNum}\t${text}\n`;
        count++;
      });
    });
  });
  
  fs.writeFileSync('BibleVerses.tsv', tsvData);
  console.log(`✅ Berhasil! File 'BibleVerses.tsv' telah dibuat dengan total ${count} ayat.`);
}

run().catch(console.error);
