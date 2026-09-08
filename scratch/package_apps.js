import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple zip file creator without third-party dependencies using standard PKZIP specification
function createZip(sourceDir, zipFilePath) {
  const files = [];

  function walk(currentDir, relDir = '') {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      const relPath = relDir ? `${relDir}/${item.name}` : item.name;
      if (item.isDirectory()) {
        walk(fullPath, relPath);
      } else if (item.isFile()) {
        files.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
      }
    }
  }

  walk(sourceDir);

  // Buffer accumulator for zip content
  const localHeaders = [];
  const centralDirectoryHeaders = [];
  let offset = 0;

  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  for (const file of files) {
    const data = fs.readFileSync(file.fullPath);
    const compressed = zlib.deflateRawSync(data);
    const uncompressedSize = data.length;
    const compressedSize = compressed.length;
    const crc = crc32(data);
    const nameBuf = Buffer.from(file.relPath, 'utf8');

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);          // Compression method (Deflate)
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0, 12);         // Mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18);   // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);   // File name length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader);
    localHeaders.push(compressed);

    // Central directory header (46 bytes + name length)
    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);   // Signature
    cdHeader.writeUInt16LE(20, 4);           // Version made by
    cdHeader.writeUInt16LE(20, 6);           // Version needed
    cdHeader.writeUInt16LE(0, 8);            // Flags
    cdHeader.writeUInt16LE(8, 10);           // Deflate
    cdHeader.writeUInt16LE(0, 12);           // Time
    cdHeader.writeUInt16LE(0, 14);           // Date
    cdHeader.writeUInt32LE(crc, 16);         // CRC
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);           // Extra field length
    cdHeader.writeUInt16LE(0, 32);           // Comment length
    cdHeader.writeUInt16LE(0, 34);           // Disk start
    cdHeader.writeUInt16LE(0, 36);           // Internal attrs
    cdHeader.writeUInt32LE(0, 38);           // External attrs
    cdHeader.writeUInt32LE(offset, 42);      // Relative offset of local header
    nameBuf.copy(cdHeader, 46);

    centralDirectoryHeaders.push(cdHeader);
    offset += localHeader.length + compressed.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDirectoryHeaders) {
    cdSize += cd.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                     // Disk number
  eocd.writeUInt16LE(0, 6);                     // Start disk
  eocd.writeUInt16LE(files.length, 8);          // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10);         // Total records
  eocd.writeUInt32LE(cdSize, 12);               // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16);             // Offset of central directory
  eocd.writeUInt16LE(0, 20);                    // Comment length

  const finalBuf = Buffer.concat([...localHeaders, ...centralDirectoryHeaders, eocd]);
  fs.writeFileSync(zipFilePath, finalBuf);
  console.log(`Created ${path.basename(zipFilePath)} (${finalBuf.length} bytes, ${files.length} files)`);
}

const apps = [
  { dir: 'my-passes', zip: 'my-passes.zip' },
  { dir: 'gate-console', zip: 'gate-console.zip' },
  { dir: 'approvals', zip: 'approvals.zip' },
  { dir: 'reports', zip: 'reports.zip' },
  { dir: 'footfall', zip: 'footfall.zip' },
  { dir: 'admin-plants', zip: 'admin-plants.zip' },
  { dir: 'admin-employees', zip: 'admin-employees.zip' },
  { dir: 'admin-areas', zip: 'admin-areas.zip' }
];

for (const app of apps) {
  const source = path.resolve(__dirname, '..', 'app', app.dir, 'webapp');
  const target = path.resolve(__dirname, '..', 'app', app.dir, app.zip);
  createZip(source, target);
}
console.log('All packages updated successfully.');
