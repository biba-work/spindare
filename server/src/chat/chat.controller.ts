import { Controller, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { StreamChat } from 'stream-chat';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Replaces supabase/functions/get-stream-token/index.ts, the Supabase Edge
// Function that died along with the rest of the Supabase project. Stream
// Chat requires a server-signed token per user — this can only ever run
// server-side (STREAM_SECRET must never ship in the mobile app).
//
// One deliberate change from the original: the token is minted for
// @CurrentUser() (the Clerk-verified caller), not for whatever userId the
// client sends in the request body — the old edge function trusted the
// body, which meant anyone could request a token impersonating any user id.
//
// Stream is on hold for now (deprioritized) — client is created lazily, and
// the endpoint returns a clean 503 instead of crashing the whole server if
// STREAM_KEY/STREAM_SECRET aren't set. Wire the env vars in whenever chat
// comes back around; nothing else needs to change.
@Controller('chat')
@UseGuards(ClerkAuthGuard)
export class ChatController {
  private client: StreamChat | null = null;

  private getClient(): StreamChat {
    if (!process.env.STREAM_KEY || !process.env.STREAM_SECRET) {
      throw new ServiceUnavailableException('Stream Chat is not configured yet.');
    }
    if (!this.client) {
      this.client = StreamChat.getInstance(process.env.STREAM_KEY, process.env.STREAM_SECRET);
    }
    return this.client;
  }

  @Post('token')
  getToken(@CurrentUser() userId: string) {
    return { token: this.getClient().createToken(userId) };
  }
}
