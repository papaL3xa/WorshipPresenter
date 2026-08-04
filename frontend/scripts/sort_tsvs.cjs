const fs = require('fs');
const path = require('path');

const songsFile = path.join(__dirname, '../public/data/Songs.tsv');
const segmentsFile = path.join(__dirname, '../public/data/SongSegments.tsv');

// Helper to extract the number from LSEB_123 or similar IDs
function parseIdNum(id) {
  if (id.startsWith('LSEB_')) {
    return parseInt(id.substring(5), 10) || 999999;
  }
  return 999999;
}

// 1. Sort Songs.tsv
const songsContent = fs.readFileSync(songsFile, 'utf8');
const songsLines = songsContent.split('\n');
const songsHeader = songsLines[0];
const songsDataLines = songsLines.slice(1).filter(line => line.trim() !== '');

songsDataLines.sort((a, b) => {
  const partsA = a.split('\t');
  const partsB = b.split('\t');
  if (partsA.length < 1 || partsB.length < 1) return 0;
  
  const numA = parseIdNum(partsA[0]);
  const numB = parseIdNum(partsB[0]);
  
  return numA - numB;
});

const sortedSongsContent = [songsHeader, ...songsDataLines].join('\n');
fs.writeFileSync(songsFile, sortedSongsContent, 'utf8');
console.log('Songs.tsv sorted successfully.');

// 2. Sort SongSegments.tsv
const segmentsContent = fs.readFileSync(segmentsFile, 'utf8');
const segmentsLines = segmentsContent.split('\n');
const segmentsHeader = segmentsLines[0];
const segmentsDataLines = segmentsLines.slice(1).filter(line => line.trim() !== '');

segmentsDataLines.sort((a, b) => {
  const partsA = a.split('\t');
  const partsB = b.split('\t');
  if (partsA.length < 5 || partsB.length < 5) return 0;
  
  const numA = parseIdNum(partsA[1]); // songId is index 1
  const numB = parseIdNum(partsB[1]);
  
  if (numA !== numB) {
    return numA - numB;
  }
  
  // If same song, sort by order (index 4)
  const orderA = parseInt(partsA[4], 10) || 0;
  const orderB = parseInt(partsB[4], 10) || 0;
  return orderA - orderB;
});

const sortedSegmentsContent = [segmentsHeader, ...segmentsDataLines].join('\n');
fs.writeFileSync(segmentsFile, sortedSegmentsContent, 'utf8');
console.log('SongSegments.tsv sorted successfully.');
