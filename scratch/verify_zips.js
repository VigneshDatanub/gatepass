import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readZip(zipPath) {
  const buf = fs.readFileSync(zipPath);
  // Find End of Central Directory
  let eocdOffset = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset === -1) throw new Error('Not a valid zip');

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  let offset = cdOffset;
  const entries = {};

  for (let i = 0; i < totalEntries; i++) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x02014b50) throw new Error('Invalid CD header signature');
    const compMethod = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const uncompSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);

    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    
    // Read from local header
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
    const compData = buf.subarray(dataOffset, dataOffset + compSize);
    
    let uncompData;
    if (compMethod === 8) {
      uncompData = zlib.inflateRawSync(compData);
    } else if (compMethod === 0) {
      uncompData = compData;
    } else {
      throw new Error(`Unsupported compression method: ${compMethod}`);
    }

    entries[name] = uncompData.toString('utf8');
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const apps = [
  'my-passes',
  'gate-console',
  'approvals',
  'reports',
  'footfall',
  'admin-plants',
  'admin-employees',
  'admin-areas'
];

let allPassed = true;

for (const app of apps) {
  const zipFile = path.resolve(__dirname, '..', 'app', app, `${app}.zip`);
  const entries = readZip(zipFile);
  const fileNames = Object.keys(entries);
  
  const hasManifest = !!entries['manifest.json'];
  const hasXsApp = !!entries['xs-app.json'];
  
  let crossNavOk = false;
  let xsAppOk = false;

  if (hasManifest) {
    const manifest = JSON.parse(entries['manifest.json']);
    const inbounds = manifest['sap.app']?.crossNavigation?.inbounds;
    crossNavOk = !!(inbounds && Object.keys(inbounds).length > 0);
  }

  if (hasXsApp) {
    const xsApp = JSON.parse(entries['xs-app.json']);
    xsAppOk = xsApp.routes?.some(r => r.destination === 'srv-api');
  }

  console.log(`[${app}] files: [${fileNames.join(', ')}] | crossNav: ${crossNavOk} | xsApp srv-api: ${xsAppOk}`);
  if (!crossNavOk || !xsAppOk) allPassed = false;
}

if (allPassed) {
  console.log('\nSUCCESS: All 8 applications verified with valid inbounds and backend routing!');
} else {
  console.error('\nFAILURE: Some applications failed verification!');
  process.exit(1);
}
