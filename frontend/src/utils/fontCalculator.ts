/**
 * Utility untuk menghitung ukuran font optimal secara otomatis (Auto-Fit Dinamis)
 * Menyesuaikan teks agar tetap besar, tebal, dan proporsional baik untuk teks pendek,
 * lirik lagu, ayat alkitab yang panjang, maupun pengumuman multi-baris.
 */

export interface FontCalculatorOptions {
  is2Column?: boolean;
  isLowerThird?: boolean;
  lineHeight?: number;
  fontSizeOffset?: number;
  maxSize?: number;
  minSize?: number;
}

/**
 * Menghitung jumlah baris aktual yang dihasilkan dari word-wrapping
 */
function countWrappedLines(paragraph: string, maxCharsPerLine: number): number {
  if (!paragraph.trim()) return 0;
  const words = paragraph.split(/\s+/);
  if (words.length === 0) return 0;

  let lines = 1;
  let currentLen = 0;

  for (const word of words) {
    if (!word) continue;
    if (currentLen === 0) {
      currentLen = word.length;
    } else if (currentLen + 1 + word.length <= maxCharsPerLine) {
      currentLen += 1 + word.length;
    } else {
      lines++;
      currentLen = word.length;
    }
  }

  return lines;
}

/**
 * Menghitung ukuran font (dalam satuan cqw) yang memaksimalkan ukuran teks
 * tanpa terpotong atau keluar dari batas layar.
 */
export function calculateOptimalFontSize(
  rawText: string,
  options: FontCalculatorOptions = {}
): number {
  if (!rawText || !rawText.trim()) return 6.5;

  const {
    is2Column = false,
    isLowerThird = false,
    lineHeight = 1.16,
    fontSizeOffset = 0,
    maxSize: customMaxSize,
    minSize = 2.0
  } = options;

  // Bersihkan format tag warna dan kolom
  let cleanText = rawText.replace(/\[\/?(merah|kuning|hijau|biru|ungu|oranye|kolom2)\]/gi, '');
  cleanText = cleanText.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]/g, ''); // bersihkan chord

  // Jika format kolom dwi-bahasa atau 2-kolom
  let subTexts = [cleanText];
  let effective2Col = is2Column;
  if (cleanText.includes('\n[kuning]')) {
    subTexts = cleanText.split('\n[kuning]');
    effective2Col = true;
  } else if (cleanText.includes('\n[kolom2]')) {
    subTexts = cleanText.split('\n[kolom2]');
    effective2Col = true;
  }

  const explicitLines = cleanText.split('\n').filter(l => l.trim().length > 0);
  const lineCount = explicitLines.length;

  // Area tinggi teks aman di DisplayWindow (16:9 total tinggi 56.25cqw, content area top 18% bottom 12% minus bait label 3.5cqw):
  // Menghasilkan ruang tinggi aman ~35.5cqw.
  const availableHeight = isLowerThird ? 17.0 : 35.5;
  const availableWidth = effective2Col ? 40.5 : 84.0;

  // Tentukan batas atas ukuran font (maxSize) yang proporsional sesuai jumlah baris
  let maxSize = customMaxSize !== undefined ? customMaxSize : 7.0;
  if (customMaxSize === undefined) {
    if (isLowerThird) {
      maxSize = 4.8;
    } else if (lineCount >= 10) {
      maxSize = 3.6;
    } else if (lineCount >= 8) {
      maxSize = 4.2;
    } else if (lineCount >= 6) {
      maxSize = 4.8;
    } else if (lineCount >= 4) {
      maxSize = 5.8;
    } else if (lineCount >= 2) {
      maxSize = 6.4;
    } else {
      maxSize = 6.8;
    }
  }

  // Sanitasi lineHeight agar berada dalam rentang wajar (1.12 - 1.25)
  // Mencegah nilai warisan lama yang terlalu renggang (seperti 1.6) mengecilkan font secara drastis
  const effectiveLineHeight = Math.min(1.25, Math.max(1.12, Number(lineHeight) || 1.16));

  // Cari kata terpanjang untuk memastikan tidak ada 1 kata yang meluap horizontal
  const allWords = cleanText.split(/\s+/).filter(Boolean);
  const maxWordLength = allWords.length > 0 ? Math.max(...allWords.map(w => w.length)) : 1;

  // Uji ukuran font dari yang terbesar ke yang terkecil (langkah 0.05cqw)
  for (let s = maxSize; s >= minSize; s -= 0.05) {
    // Estimasi lebar rata-rata karakter pada font tebal sans-serif (Inter / Poppins)
    // Sekitar 0.49 x font_size
    const charWidth = s * 0.49;

    // Pastikan kata terpanjang muat dalam 1 baris
    if (maxWordLength * charWidth > availableWidth) {
      continue;
    }

    const maxCharsPerLine = Math.floor(availableWidth / charWidth);
    if (maxCharsPerLine <= 0) continue;

    // Hitung total tinggi untuk setiap bagian/kolom
    let fitsAll = true;
    for (const sub of subTexts) {
      const paragraphs = sub.split('\n');
      let totalLines = 0;

      for (const p of paragraphs) {
        if (!p.trim()) {
          totalLines += 0.7; // spasi antar paragraf
        } else {
          totalLines += countWrappedLines(p, maxCharsPerLine);
        }
      }

      const totalHeight = totalLines * s * effectiveLineHeight;
      if (totalHeight > availableHeight) {
        fitsAll = false;
        break;
      }
    }

    if (fitsAll) {
      const finalSize = Math.max(minSize, Math.round(s * 10) / 10 + fontSizeOffset);
      return Math.round(finalSize * 10) / 10;
    }
  }

  const fallback = Math.max(minSize, minSize + fontSizeOffset);
  return Math.round(fallback * 10) / 10;
}
