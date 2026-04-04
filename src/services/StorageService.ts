import * as FileSystem from 'expo-file-system';

// ── R2 configuration ────────────────────────────────────────────────────────
// Add these to your .env:
//   EXPO_PUBLIC_R2_UPLOAD_ENDPOINT=https://a927d8dff6eb70ae46efac1d9a36eb30.r2.cloudflarestorage.com
//   EXPO_PUBLIC_R2_BUCKET=spindare
//   EXPO_PUBLIC_R2_ACCESS_KEY_ID=your-r2-api-token-id
//   EXPO_PUBLIC_R2_SECRET_ACCESS_KEY=your-r2-api-token-secret
//   EXPO_PUBLIC_R2_PUBLIC_URL=https://pub-ef45291acf4144e6abf0931a05c926de.r2.dev
const ENDPOINT   = process.env.EXPO_PUBLIC_R2_UPLOAD_ENDPOINT ?? '';
const BUCKET     = process.env.EXPO_PUBLIC_R2_BUCKET ?? '';
const ACCESS_KEY = process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID ?? '';
const SECRET_KEY = process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY ?? '';
const PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

// R2 always uses region "auto" for the S3-compatible API
const REGION = 'auto';
// Using UNSIGNED-PAYLOAD avoids hashing the entire file in JS (valid over HTTPS)
const PAYLOAD_HASH = 'UNSIGNED-PAYLOAD';

// ── Minimal Web Crypto helpers (Hermes / Expo SDK 55 supports crypto.subtle) ─

const encoder = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(message));
  return bufToHex(digest);
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
): Promise<ArrayBuffer> {
  const kDate    = await hmacSha256(encoder.encode(`AWS4${secretKey}`), dateStamp);
  const kRegion  = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

// ── AWS Signature Version 4 for a PUT object request ────────────────────────

async function buildSigV4Headers(
  urlStr: string,
  mimeType: string,
): Promise<Record<string, string>> {
  const url = new URL(urlStr);
  const now = new Date();
  // Format: YYYYMMDD
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  // Format: YYYYMMDDTHHmmssZ
  const amzDate = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';

  const canonicalHeaders =
    `content-type:${mimeType}\n` +
    `host:${url.host}\n` +
    `x-amz-content-sha256:${PAYLOAD_HASH}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    url.pathname,
    '', // no query string
    canonicalHeaders,
    signedHeaders,
    PAYLOAD_HASH,
  ].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(SECRET_KEY, dateStamp, REGION);
  const signature  = bufToHex(await hmacSha256(signingKey, stringToSign));

  return {
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': mimeType,
    'x-amz-content-sha256': PAYLOAD_HASH,
    'x-amz-date': amzDate,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Uploads a local file URI to Cloudflare R2 using the S3-compatible API.
 *
 * @param localUri   - file:// URI from ImagePicker or Camera
 * @param folder     - logical folder prefix (e.g. 'posts', 'proofs')
 * @param mimeType   - MIME type (e.g. 'image/jpeg', 'video/mp4')
 * @param onProgress - optional 0–100 progress callback
 * @returns { publicUrl } — publicly accessible URL of the uploaded file
 */
export async function uploadToR2(
  localUri: string,
  folder: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<{ publicUrl: string }> {
  if (!ENDPOINT || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error(
      'R2 not fully configured — check EXPO_PUBLIC_R2_ENDPOINT, EXPO_PUBLIC_R2_BUCKET, ' +
      'EXPO_PUBLIC_R2_ACCESS_KEY_ID, EXPO_PUBLIC_R2_SECRET_ACCESS_KEY in your .env',
    );
  }

  const ext       = mimeType.split('/')[1] ?? 'bin';
  const objectKey = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const uploadUrl = `${ENDPOINT}/${BUCKET}/${objectKey}`;

  const headers = await buildSigV4Headers(uploadUrl, mimeType);

  const task = FileSystem.createUploadTask(
    uploadUrl,
    localUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    },
    onProgress
      ? (data) => {
          if (data.totalBytesExpectedToSend > 0) {
            onProgress(
              Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100),
            );
          }
        }
      : undefined,
  );

  const result = await task.uploadAsync();

  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`R2 upload failed: HTTP ${result?.status ?? 'no response'}`);
  }

  // Build the public URL — prefer the configured public domain over the API endpoint
  const publicUrl = PUBLIC_URL
    ? `${PUBLIC_URL}/${objectKey}`
    : `${ENDPOINT}/${BUCKET}/${objectKey}`;

  return { publicUrl };
}
