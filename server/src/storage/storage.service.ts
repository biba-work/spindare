import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Replaces the Supabase Storage 'spindare-assets' bucket used in
// PostService.ts. Works against any S3-compatible endpoint — Cloudflare R2
// is the recommended default (10GB free, no egress fees, S3 API-compatible),
// but this will also work unmodified against real AWS S3, Backblaze B2, etc.
// Just set the three env vars below to match whichever you pick.
@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET ?? 'spindare-assets';
    this.publicBaseUrl = process.env.STORAGE_PUBLIC_URL ?? '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.STORAGE_ENDPOINT, // e.g. https://<account_id>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  /**
   * Uploads a base64-encoded file (matches how PostService currently reads
   * media before sending it to Supabase Storage) and returns its public URL.
   */
  async uploadBase64(base64Data: string, contentType: string, folder = 'posts'): Promise<string> {
    const buffer = Buffer.from(base64Data, 'base64');
    const key = `${folder}/${randomUUID()}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  /**
   * Presigned PUT URL for streaming uploads (large video files) — replaces
   * Supabase Storage's createSignedUploadUrl(). The mobile client PUTs the
   * raw file bytes directly to `uploadUrl`; the file is reachable afterwards
   * at `publicUrl`. Nothing passes through the Nest server itself, same
   * no-OOM behavior the original video upload relied on.
   */
  async getUploadUrl(filename: string, contentType: string, folder = 'posts') {
    const key = `${folder}/${filename}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );

    return {
      uploadUrl,
      publicUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`,
    };
  }
}
