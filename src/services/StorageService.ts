import { Platform } from 'react-native';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_R2_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY!;
const BUCKET = process.env.EXPO_PUBLIC_R2_BUCKET!;
const PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL!;

const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Minimal HMAC-SHA256 + AWS SigV4 signing using SubtleCrypto (works in RN via Hermes)
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignedPutUrl(key: string, contentType: string): Promise<string> {
  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '');   // YYYYMMDD
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ
  const region = 'auto';
  const service = 's3';
  const scope = `${datestamp}/${region}/${service}/aws4_request`;
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;

  // Canonical query string for presigned URL
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${ACCESS_KEY_ID}/${scope}`,
    'X-Amz-Date': amzdate,
    'X-Amz-Expires': '3600',
    'X-Amz-SignedHeaders': 'host',
  };
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    `/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
    sortedQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzdate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  // Derive signing key
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${SECRET_ACCESS_KEY}`), datestamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `${ENDPOINT}/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

export interface UploadResult {
  publicUrl: string;
  key: string;
}

/**
 * Uploads a local file URI to R2 and returns the public CDN URL.
 * @param localUri  - e.g. from ImagePicker: file:///...  or a blob URI
 * @param folder    - destination folder in the bucket, e.g. "posts" or "proofs"
 * @param mimeType  - e.g. "image/jpeg"
 */
export async function uploadToR2(
  localUri: string,
  folder: string = 'uploads',
  mimeType: string = 'image/jpeg'
): Promise<UploadResult> {
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Fetch the local file as a blob
  const response = await fetch(localUri);
  const blob = await response.blob();

  const signedUrl = await getSignedPutUrl(key, mimeType);

  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`R2 upload failed (${uploadResponse.status}): ${text}`);
  }

  const publicUrl = `${PUBLIC_URL}/${key}`;
  return { publicUrl, key };
}

const StorageService = { uploadToR2 };
export default StorageService;