import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2Config {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface PresignedUploadOptions {
  userId: string;
  meetingId: string;
  filename?: string;
  contentType?: string;
  expiresIn?: number; // seconds, default 900 (15 minutes)
}

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
}

export interface PresignedDownloadOptions {
  objectKey: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

/**
 * Loads and validates Cloudflare R2 credentials from server-side environment variables.
 * Permanent credentials are kept strictly server-side and never exposed.
 */
export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 storage credentials are not configured on the server");
  }

  return { accountId, bucketName, accessKeyId, secretAccessKey };
}

let cachedR2Client: S3Client | null = null;

/**
 * Returns an S3Client instance configured for Cloudflare R2's S3-compatible API.
 */
export function getR2Client(): S3Client {
  if (cachedR2Client) {
    return cachedR2Client;
  }

  const { accountId, accessKeyId, secretAccessKey } = getR2Config();

  cachedR2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedR2Client;
}

/**
 * Sanitizes a filename to prevent directory traversal and remove invalid characters.
 */
export function sanitizeFilename(filename: string): string {
  // Strip paths, null bytes, and keep only safe alphanumeric/dash/underscore/dot characters
  const base = filename.replace(/^.*[\\/]/, "").replace(/\0/g, "");
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return sanitized || "recording.mp4";
}

/**
 * Extracts a safe file extension from a filename or MIME type.
 */
export function getExtension(filename?: string, contentType?: string): string {
  if (filename) {
    const match = filename.match(/\.([a-zA-Z0-9]+)$/);
    if (match && match[1]) {
      const ext = match[1].toLowerCase();
      // Common valid media extensions
      if (["mp4", "webm", "mov", "m4a", "mp3", "wav", "ogg", "aac", "mkv"].includes(ext)) {
        return ext;
      }
    }
  }

  if (contentType) {
    const cleanType = contentType.toLowerCase().split(";")[0].trim();
    const typeMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "video/x-matroska": "mkv",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
      "audio/aac": "aac",
    };
    if (typeMap[cleanType]) {
      return typeMap[cleanType];
    }
  }

  return "mp4";
}

/**
 * Generates a unique, collision-resistant object key partitioned per user and meeting.
 * Pattern: recordings/${userId}/${meetingId}/${timestamp}-${uuid}.${extension}
 */
export function generateRecordingObjectKey({
  userId,
  meetingId,
  filename,
  contentType,
}: {
  userId: string;
  meetingId: string;
  filename?: string;
  contentType?: string;
}): string {
  if (!userId || !userId.trim()) {
    throw new Error("userId is required to generate recording object key");
  }
  if (!meetingId || !meetingId.trim()) {
    throw new Error("meetingId is required to generate recording object key");
  }

  const ext = getExtension(filename, contentType);
  const timestamp = Date.now();
  const randomSuffix = crypto.randomUUID();

  return `recordings/${userId.trim()}/${meetingId.trim()}/${timestamp}-${randomSuffix}.${ext}`;
}

/**
 * Generates a short-lived presigned PUT URL for directly uploading a recording
 * to the private Cloudflare R2 bucket.
 *
 * Keeps permanent credentials server-side and returns only the signed upload URL and object key.
 */
export async function createPresignedUploadUrl({
  userId,
  meetingId,
  filename,
  contentType,
  expiresIn = 900, // 15 minutes default
}: PresignedUploadOptions): Promise<PresignedUploadResult> {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  const objectKey = generateRecordingObjectKey({
    userId,
    meetingId,
    filename,
    contentType,
  });

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ...(contentType ? { ContentType: contentType } : {}),
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn,
  });

  return {
    uploadUrl,
    objectKey,
  };
}

/**
 * Generates a short-lived presigned GET URL for playback or server-side media processing.
 */
export async function createPresignedDownloadUrl({
  objectKey,
  expiresIn = 3600, // 1 hour default
}: PresignedDownloadOptions): Promise<string> {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Deletes an object from the private Cloudflare R2 bucket.
 */
export async function deleteRecordingObject(objectKey: string): Promise<void> {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );
}
