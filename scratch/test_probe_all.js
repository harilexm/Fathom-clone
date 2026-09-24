const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => {
  const idx = l.indexOf('=');
  return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
}));

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://' + envVars.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
  credentials: { accessKeyId: envVars.R2_ACCESS_KEY_ID, secretAccessKey: envVars.R2_SECRET_ACCESS_KEY },
});

function parseStandardMp4Duration(buf) {
  const moovIdx = buf.indexOf(Buffer.from("moov"));
  if (moovIdx === -1) return null;

  const mvhdIdx = buf.indexOf(Buffer.from("mvhd"), moovIdx);
  if (mvhdIdx === -1 || mvhdIdx + 28 > buf.length) return null;

  const mvhdStart = mvhdIdx + 4;
  const version = buf.readUInt8(mvhdStart);

  let timescale;
  let duration;

  if (version === 1) {
    if (mvhdStart + 32 > buf.length) return null;
    timescale = buf.readUInt32BE(mvhdStart + 20);
    duration = Number(buf.readBigUInt64BE(mvhdStart + 24));
  } else {
    if (mvhdStart + 24 > buf.length) return null;
    timescale = buf.readUInt32BE(mvhdStart + 12);
    duration = buf.readUInt32BE(mvhdStart + 16);
  }

  if (timescale > 0 && duration > 0) {
    const seconds = duration / timescale;
    if (Number.isFinite(seconds) && seconds > 0 && seconds < 864000) {
      return Math.max(1, Math.round(seconds));
    }
  }

  return null;
}

function parseFragmentedMp4Duration(headerBuf, tailBuf) {
  const trackTimescales = new Map();
  let trakPos = 0;
  while ((trakPos = headerBuf.indexOf(Buffer.from("trak"), trakPos + 1)) !== -1) {
    const tkhdIdx = headerBuf.indexOf(Buffer.from("tkhd"), trakPos);
    const mdhdIdx = headerBuf.indexOf(Buffer.from("mdhd"), trakPos);

    if (tkhdIdx !== -1 && mdhdIdx !== -1 && tkhdIdx < trakPos + 300 && mdhdIdx < trakPos + 600) {
      const tkhdStart = tkhdIdx + 4;
      const tkhdVer = headerBuf.readUInt8(tkhdStart);
      const trackId = tkhdVer === 1 ? headerBuf.readUInt32BE(tkhdStart + 20) : headerBuf.readUInt32BE(tkhdStart + 12);

      const mdhdStart = mdhdIdx + 4;
      const mdhdVer = headerBuf.readUInt8(mdhdStart);
      const timescale = mdhdVer === 1 ? headerBuf.readUInt32BE(mdhdStart + 20) : headerBuf.readUInt32BE(mdhdStart + 12);

      if (trackId > 0 && timescale > 0) {
        trackTimescales.set(trackId, timescale);
      }
    }
  }

  let maxDuration = 0;
  let pos = 0;
  while ((pos = tailBuf.indexOf(Buffer.from("traf"), pos + 1)) !== -1) {
    const tfhdIdx = tailBuf.indexOf(Buffer.from("tfhd"), pos);
    const tfdtIdx = tailBuf.indexOf(Buffer.from("tfdt"), pos);

    if (tfhdIdx !== -1 && tfhdIdx < pos + 250 && tfdtIdx !== -1 && tfdtIdx < pos + 250) {
      const trackId = tailBuf.readUInt32BE(tfhdIdx + 8);
      const tfdtStart = tfdtIdx + 4;
      const tfdtVer = tailBuf.readUInt8(tfdtStart);
      const decodeTime = tfdtVer === 1 ? Number(tailBuf.readBigUInt64BE(tfdtStart + 8)) : tailBuf.readUInt32BE(tfdtStart + 8);

      const timescale = trackTimescales.get(trackId);
      if (timescale && timescale > 0 && decodeTime > 0) {
        const seconds = decodeTime / timescale;
        if (Number.isFinite(seconds) && seconds > maxDuration && seconds < 864000) {
          maxDuration = seconds;
        }
      }
    }
  }

  if (maxDuration > 0) {
    return Math.max(1, Math.round(maxDuration));
  }

  return null;
}

async function probe(key) {
  const headerRes = await s3.send(new GetObjectCommand({ Bucket: envVars.R2_BUCKET_NAME, Key: key, Range: 'bytes=0-1048575' }));
  const chunks1 = [];
  for await (const c of headerRes.Body) chunks1.push(c);
  const headerBuf = Buffer.concat(chunks1);

  const std = parseStandardMp4Duration(headerBuf);
  if (std) return { key, duration: std, type: 'standard-header' };

  let totalSize = 0;
  if (typeof headerRes.ContentRange === 'string') {
    const match = headerRes.ContentRange.match(/\/(\d+)$/);
    if (match) totalSize = parseInt(match[1], 10);
  }
  if (!totalSize) totalSize = headerRes.ContentLength || 0;

  if (totalSize > 262144) {
    const tailStart = Math.max(0, totalSize - 524288);
    const tailRes = await s3.send(new GetObjectCommand({
      Bucket: envVars.R2_BUCKET_NAME,
      Key: key,
      Range: `bytes=${tailStart}-${totalSize - 1}`
    }));
    const chunks2 = [];
    for await (const c of tailRes.Body) chunks2.push(c);
    const tailBuf = Buffer.concat(chunks2);

    const tailStd = parseStandardMp4Duration(tailBuf);
    if (tailStd) return { key, duration: tailStd, type: 'standard-tail' };

    const fmp4 = parseFragmentedMp4Duration(headerBuf, tailBuf);
    if (fmp4) return { key, duration: fmp4, type: 'fragmented' };
  }

  return { key, duration: null, type: 'unknown' };
}

const keys = [
  'recordings/fae5fe63-e314-4db2-8400-8c842cda2dcf/a119ae94-ff58-45ae-b9a3-5c65237f2a14/1790286010588-4341662e-5a79-41a2-a459-a1fbf58ad759.mp4',
  'recordings/fae5fe63-e314-4db2-8400-8c842cda2dcf/85f548bd-9a61-48a3-989b-aa2ceceab2e6/1790286037850-e81b7196-2d5c-43bb-94ec-86192ae160d9.mp4',
  'recordings/fae5fe63-e314-4db2-8400-8c842cda2dcf/9032c083-de71-459c-b1e6-0e8a6701ed45/1790286595503-bbf5ad9d-0357-447a-a873-f7f96705d8f8.mp4',
  'recordings/f105596a-0cda-433b-86c1-8917a532619f/6270fcca-f871-4aef-8595-c355fe3c0aa8/1790289041848-b2266765-9471-4eb8-b392-94a590157da3.mp4',
];

async function main() {
  for (const k of keys) {
    const res = await probe(k);
    console.log(res);
  }
}

main();
