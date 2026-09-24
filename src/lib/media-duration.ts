import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

function getR2Client(): { client: S3Client; bucket: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

/**
 * Parses standard MP4/MOV/M4A duration from a buffer containing `moov` -> `mvhd`.
 */
export function parseStandardMp4Duration(buf: Buffer): number | null {
  const moovIdx = buf.indexOf(Buffer.from("moov"));
  if (moovIdx === -1) return null;

  const mvhdIdx = buf.indexOf(Buffer.from("mvhd"), moovIdx);
  if (mvhdIdx === -1 || mvhdIdx + 28 > buf.length) return null;

  const mvhdStart = mvhdIdx + 4;
  const version = buf.readUInt8(mvhdStart);

  let timescale: number;
  let duration: number;

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

/**
 * Parses fragmented MP4 (fMP4) duration by inspecting track timescales in `moov`
 * and track fragment decode times in the tail `moof` -> `traf`.
 */
export function parseFragmentedMp4Duration(headerBuf: Buffer, tailBuf: Buffer): number | null {
  // 1. Map trackId -> timescale by parsing each `trak` in header
  const trackTimescales = new Map<number, number>();
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

  // 2. Scan tailBuf for `traf` boxes to find decodeTime and matching trackId
  let maxDuration = 0;
  let pos = 0;
  while ((pos = tailBuf.indexOf(Buffer.from("traf"), pos + 1)) !== -1) {
    const tfhdIdx = tailBuf.indexOf(Buffer.from("tfhd"), pos);
    const tfdtIdx = tailBuf.indexOf(Buffer.from("tfdt"), pos);

    if (tfhdIdx !== -1 && tfhdIdx < pos + 250 && tfdtIdx !== -1 && tfdtIdx < pos + 250) {
      const trackId = tailBuf.readUInt32BE(tfhdIdx + 8);
      const tfdtVer = tailBuf.readUInt8(tfdtIdx + 4);
      const decodeTime = tfdtVer === 1 ? Number(tailBuf.readBigUInt64BE(tfdtIdx + 8)) : tailBuf.readUInt32BE(tfdtIdx + 8);

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

/**
 * Probes the duration of an R2 media object by fetching minimal byte ranges.
 */
export async function probeR2MediaDuration(objectKey: string, fileSize?: number): Promise<number | null> {
  const r2 = getR2Client();
  if (!r2) return null;

  try {
    // 1. Fetch first 1MB (covers ftyp, moov, mvhd, mdhd)
    const headerRange = "bytes=0-1048575";
    const headerRes = await r2.client.send(
      new GetObjectCommand({
        Bucket: r2.bucket,
        Key: objectKey,
        Range: headerRange,
      })
    );

    const headerChunks: Buffer[] = [];
    for await (const chunk of headerRes.Body as AsyncIterable<Uint8Array>) {
      headerChunks.push(Buffer.from(chunk));
    }
    const headerBuf = Buffer.concat(headerChunks);

    // Try standard MP4
    const stdDuration = parseStandardMp4Duration(headerBuf);
    if (stdDuration) return stdDuration;

    // 2. If standard duration was not in header or was 0 (fMP4), check tail if file is large enough
    let totalSize = typeof fileSize === "number" && fileSize > 0 ? fileSize : 0;
    if (!totalSize && typeof headerRes.ContentRange === "string") {
      const match = headerRes.ContentRange.match(/\/(\d+)$/);
      if (match) totalSize = parseInt(match[1], 10);
    }
    if (!totalSize) {
      totalSize = headerRes.ContentLength || 0;
    }
    if (totalSize > 262144) {
      const tailStart = Math.max(0, totalSize - 524288);
      const tailRes = await r2.client.send(
        new GetObjectCommand({
          Bucket: r2.bucket,
          Key: objectKey,
          Range: `bytes=${tailStart}-${totalSize - 1}`,
        })
      );
      const tailChunks: Buffer[] = [];
      for await (const c of tailRes.Body as AsyncIterable<Uint8Array>) {
        tailChunks.push(Buffer.from(c));
      }
      const tailBuf = Buffer.concat(tailChunks);

      // Check standard moov at end of file (faststart not applied)
      const tailStd = parseStandardMp4Duration(tailBuf);
      if (tailStd) return tailStd;

      // Check fragmented MP4
      const fmp4Duration = parseFragmentedMp4Duration(headerBuf, tailBuf);
      if (fmp4Duration) return fmp4Duration;
    }

    return null;
  } catch (err) {
    console.error("Failed to probe media duration from R2:", err);
    return null;
  }
}
