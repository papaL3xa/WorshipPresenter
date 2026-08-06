const fs = require('fs');
const Papa = require('papaparse');

const text = fs.readFileSync('/home/sagala/pisgahbisdac/PB/frontend/public/data/BibleVerses_TB.tsv', 'utf-8');
const result = Papa.parse(text.trim(), {
  delimiter: '\t',
  header: true,
  skipEmptyLines: true,
  quoteChar: '',
});

console.log("Parsed rows:", result.data.length);
if (result.errors.length > 0) {
  console.log("Errors:", result.errors[0]);
}

const books = new Set();
result.data.forEach(v => {
  if (v.book) books.add(v.book);
});
console.log("Books found:", Array.from(books).join(', '));
