import { Injectable, Logger } from '@nestjs/common';
import * as http2 from 'http2';
import * as crypto from 'crypto';

/**
 * Sends push notifications via Apple Push Notification service (APNs) using
 * HTTP/2 and JWT (p8 key) authentication.
 *
 * Required env vars:
 *   APNS_KEY_ID      — 10-char key ID from App Store Connect
 *   APNS_TEAM_ID     — 10-char team ID
 *   APNS_KEY_PATH    — absolute path to the .p8 private key file
 *   APNS_BUNDLE_ID   — app bundle ID (e.g. com.spindare.app)
 *   APNS_ENVIRONMENT — "production" or "development" (default: "development")
 */
@Injectable()
export class ApnsService {
  private readonly logger = new Logger(ApnsService.name);
  private readonly keyId: string;
  private readonly teamId: string;
  private readonly bundleId: string;
  private readonly host: string;
  private readonly privateKey: string | null;

  // JWT is valid for up to 60 min per Apple spec. We refresh at 50 min.
  private cachedToken: string | null = null;
  private tokenIssuedAt = 0;
  private static readonly TOKEN_TTL_MS = 50 * 60 * 1000;

  constructor() {
    this.keyId = process.env.APNS_KEY_ID ?? '';
    this.teamId = process.env.APNS_TEAM_ID ?? '';
    this.bundleId = process.env.APNS_BUNDLE_ID ?? '';

    const env = process.env.APNS_ENVIRONMENT ?? 'development';
    this.host =
      env === 'production'
        ? 'api.push.apple.com'
        : 'api.sandbox.push.apple.com';

    const keyPath = process.env.APNS_KEY_PATH ?? '';
    if (keyPath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        this.privateKey = fs.readFileSync(keyPath, 'utf8');
      } catch (err) {
        this.logger.warn(`Could not read APNs key at ${keyPath}: ${err}`);
        this.privateKey = null;
      }
    } else {
      this.privateKey = null;
      this.logger.warn(
        'APNS_KEY_PATH not set — push notifications are disabled',
      );
    }
  }

  /** Whether the service is configured and can send pushes. */
  get isConfigured(): boolean {
    return !!(this.privateKey && this.keyId && this.teamId && this.bundleId);
  }

  /**
   * Send a push notification to a device token.
   *
   * @param deviceToken  Hex-encoded APNs device token (no spaces, no angle brackets)
   * @param title        Alert title
   * @param body         Alert body
   * @param data         Custom payload (appears in notification.userInfo)
   */
  async send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isConfigured) {
      this.logger.debug('APNs not configured — skipping push');
      return;
    }

    const token = this.getJwt();
    const payload = JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
        'mutable-content': 1,
      },
      ...(data ?? {}),
    });

    return new Promise<void>((resolve, reject) => {
      const client = http2.connect(`https://${this.host}`);
      client.on('error', (err) => {
        this.logger.error(`APNs connection error: ${err.message}`);
        reject(err);
      });

      const cleanToken = deviceToken.replace(/[^a-fA-F0-9]/g, '');
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${cleanToken}`,
        authorization: `bearer ${token}`,
        'apns-topic': this.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      });

      let responseStatus = 0;
      let responseBody = '';

      req.on('response', (headers) => {
        responseStatus = Number(headers[':status'] ?? 0);
      });

      req.on('data', (chunk: Buffer) => {
        responseBody += chunk.toString();
      });

      req.on('end', () => {
        client.close();
        if (responseStatus === 200) {
          resolve();
        } else {
          this.logger.warn(
            `APNs rejected push to ${cleanToken.slice(0, 8)}…: ${responseStatus} ${responseBody}`,
          );
          reject(
            new Error(`APNs ${responseStatus}: ${responseBody}`),
          );
        }
      });

      req.on('error', (err) => {
        client.close();
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  // ──────────────────── JWT ────────────────────

  private getJwt(): string {
    const now = Date.now();
    if (this.cachedToken && now - this.tokenIssuedAt < ApnsService.TOKEN_TTL_MS) {
      return this.cachedToken;
    }

    const iat = Math.floor(now / 1000);
    const header = this.base64url(
      JSON.stringify({ alg: 'ES256', kid: this.keyId }),
    );
    const claims = this.base64url(
      JSON.stringify({ iss: this.teamId, iat }),
    );

    const signature = crypto
      .createSign('SHA256')
      .update(`${header}.${claims}`)
      .sign(
        { key: this.privateKey!, dsaEncoding: 'ieee-p1363' },
        'base64url',
      );

    this.cachedToken = `${header}.${claims}.${signature}`;
    this.tokenIssuedAt = now;
    return this.cachedToken;
  }

  private base64url(str: string): string {
    return Buffer.from(str)
      .toString('base64url');
  }
}
