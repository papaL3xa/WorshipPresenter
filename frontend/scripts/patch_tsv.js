import fs from 'fs';
import path from 'path';

// File paths
const dataDir = path.resolve('../public/data');
const songsTsvPath = path.join(dataDir, 'Songs.tsv');
const segmentsTsvPath = path.join(dataDir, 'SongSegments.tsv');
const updateJsonPath = path.resolve('update_songs_3.json');

// Helper to escape TSV fields
const escapeTsv = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
};

const escapeSegmentText = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/\t/g, ' ').replace(/\n/g, '\\n').replace(/\r/g, '');
}

async function main() {
    console.log('Loading update JSON...');
    const updateData = JSON.parse(fs.readFileSync(updateJsonPath, 'utf8'));
    const updatedSongsMap = new Map();
    for (const song of updateData.songs) {
        updatedSongsMap.set(song.id, song);
    }
    console.log(`Loaded ${updatedSongsMap.size} songs to update.`);

    // --- Update Songs.tsv ---
    console.log('Updating Songs.tsv...');
    const songsContent = fs.readFileSync(songsTsvPath, 'utf8');
    const songLines = songsContent.split('\n');
    const newSongLines = [];
    let songHeader = null;

    for (const line of songLines) {
        if (!line.trim()) {
            newSongLines.push(line);
            continue;
        }
        if (!songHeader) {
            songHeader = line;
            newSongLines.push(line);
            continue;
        }

        const cols = line.split('\t');
        const id = cols[0];
        if (updatedSongsMap.has(id)) {
            const upd = updatedSongsMap.get(id);
            cols[1] = escapeTsv(upd.title || cols[1]);
            cols[2] = escapeTsv(upd.author || cols[2]);
            cols[3] = escapeTsv(upd.category || cols[3]);
            cols[4] = JSON.stringify(upd.segmentOrder || JSON.parse(cols[4] || '[]'));
            newSongLines.push(cols.join('\t'));
        } else {
            newSongLines.push(line);
        }
    }
    fs.writeFileSync(songsTsvPath, newSongLines.join('\n'));
    console.log('Songs.tsv updated.');

    // --- Update SongSegments.tsv ---
    console.log('Updating SongSegments.tsv...');
    const segmentsContent = fs.readFileSync(segmentsTsvPath, 'utf8');
    const segmentLines = segmentsContent.split('\n');
    let segmentHeader = null;
    
    // We will build a completely new segment file, replacing segments for the updated songs,
    // and keeping segments for non-updated songs.
    const newSegmentLines = [];
    const existingSegmentIds = new Set();
    
    for (const line of segmentLines) {
        if (!line.trim()) {
            newSegmentLines.push(line);
            continue;
        }
        if (!segmentHeader) {
            segmentHeader = line;
            newSegmentLines.push(line);
            continue;
        }

        const cols = line.split('\t');
        const songId = cols[1];
        
        // If this segment belongs to an updated song, skip it. We will append it later.
        if (updatedSongsMap.has(songId)) {
            continue;
        } else {
            newSegmentLines.push(line);
        }
    }
    
    // Now append the updated segments
    // But wait, the blank line at the end might be messed up, let's remove trailing blank lines before appending
    while (newSegmentLines.length > 0 && !newSegmentLines[newSegmentLines.length - 1].trim()) {
        newSegmentLines.pop();
    }

    for (const [songId, song] of updatedSongsMap.entries()) {
        const segments = song.segments || [];
        const labels = song.segmentLabels || [];
        for (let i = 0; i < segments.length; i++) {
            const segmentId = `${songId}_s${i}`;
            const label = escapeTsv(labels[i] || `Bait ${i+1}`);
            const text = escapeSegmentText(segments[i]);
            const order = i + 1;
            newSegmentLines.push(`${segmentId}\t${songId}\t${label}\t${text}\t${order}`);
        }
    }
    
    // Append a final newline
    newSegmentLines.push('');
    fs.writeFileSync(segmentsTsvPath, newSegmentLines.join('\n'));
    console.log('SongSegments.tsv updated.');
    console.log('Patch complete!');
}

main().catch(console.error);
