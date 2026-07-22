import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** What the client may send as a message payload. */
export interface SendMessageInput {
  text?: string;
  kind?: 'text' | 'image' | 'voice';
  mediaURL?: string;
  duration?: number;
  samples?: number[];
  emphasis?: number;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  // Threads are keyed on the ordered pair so "A opens a chat with B" and
  // "B opens a chat with A" resolve to the same row instead of two.
  private static pair(x: string, y: string) {
    return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x };
  }

  /**
   * Shapes a message into exactly what the mobile `Message` model decodes.
   *
   * `MessagePayload` is a Swift enum with associated values using synthesized
   * Codable, which expects a single-key object naming the case:
   *   .text  -> {"text":{}}
   *   .image -> {"image":{"url":"…"}}
   *   .voice -> {"voice":{"url":"…","duration":1.5,"samples":[…]}}
   * Emitting that shape here is what keeps chat media rendering as media
   * rather than collapsing to an empty text bubble.
   */
  private shapeMessage(row: {
    id: string;
    conversationId: string;
    senderId: string;
    text: string;
    kind: string;
    mediaURL: string | null;
    duration: number | null;
    samples: unknown;
    emphasis: number | null;
    unsent: boolean;
    createdAt: Date;
  }) {
    let payload: Record<string, unknown> = { text: {} };

    // An unsent message keeps its row but sheds its content, so neither side
    // can still render the original.
    if (!row.unsent) {
      if (row.kind === 'image' && row.mediaURL) {
        payload = { image: { url: row.mediaURL } };
      } else if (row.kind === 'voice' && row.mediaURL) {
        payload = {
          voice: {
            url: row.mediaURL,
            duration: row.duration ?? 0,
            samples: Array.isArray(row.samples) ? row.samples : [],
          },
        };
      }
    }

    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      text: row.unsent ? 'Message unsent' : row.text,
      sentAt: row.createdAt,
      delivery: 'sent',
      payload,
      emphasis: row.emphasis,
    };
  }

  /** Ensures the caller actually belongs to the thread before anything else. */
  private async requireMembership(conversationId: string, userId: string) {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.userAId !== userId && convo.userBId !== userId) {
      throw new ForbiddenException('Not your conversation');
    }
    return convo;
  }

  /** Finds or creates the thread between the caller and someone else. */
  async openConversation(userId: string, otherUserId: string) {
    const key = ChatService.pair(userId, otherUserId);
    const convo = await this.prisma.conversation.upsert({
      where: { userAId_userBId: key },
      update: {},
      create: key,
    });
    return this.shapeConversation(convo, userId);
  }

  private async shapeConversation(
    convo: { id: string; userAId: string; userBId: string; lastMessage: string; lastMessageAt: Date },
    userId: string,
  ) {
    const otherId = convo.userAId === userId ? convo.userBId : convo.userAId;
    const [other, state] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: otherId } }),
      this.prisma.conversationState.findUnique({
        where: { conversationId_userId: { conversationId: convo.id, userId } },
      }),
    ]);

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: convo.id,
        senderId: { not: userId },
        createdAt: state?.lastReadAt ? { gt: state.lastReadAt } : undefined,
      },
    });

    return {
      id: convo.id,
      otherUserId: otherId,
      otherUsername: other?.username ?? 'user',
      otherAvatarURL: other?.photoURL ?? null,
      lastMessage: convo.lastMessage,
      lastMessageAt: convo.lastMessageAt,
      unreadCount,
      isMuted: state?.isMuted ?? false,
      isArchived: state?.isArchived ?? false,
    };
  }

  /** Threads the caller is in, minus ones they've cleared. `archived` splits the two lists. */
  async listConversations(userId: string, archived: boolean) {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { lastMessageAt: 'desc' },
    });

    const states = await this.prisma.conversationState.findMany({ where: { userId } });
    const byId = new Map(states.map((s) => [s.conversationId, s]));

    const visible = rows.filter((r) => {
      const s = byId.get(r.id);
      if (s?.clearedAt && r.lastMessageAt <= s.clearedAt) return false;
      return (s?.isArchived ?? false) === archived;
    });

    return Promise.all(visible.map((r) => this.shapeConversation(r, userId)));
  }

  async listMessages(conversationId: string, userId: string) {
    await this.requireMembership(conversationId, userId);
    const state = await this.prisma.conversationState.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        // Messages from before this user cleared the thread stay hidden for them.
        createdAt: state?.clearedAt ? { gt: state.clearedAt } : undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Opening a thread marks it read.
    await this.prisma.conversationState.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: { lastReadAt: new Date() },
      create: { conversationId, userId, lastReadAt: new Date() },
    });

    return rows.map((r) => this.shapeMessage(r));
  }

  async sendMessage(conversationId: string, userId: string, input: SendMessageInput) {
    const convo = await this.requireMembership(conversationId, userId);

    const kind = input.kind ?? 'text';
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        text: input.text ?? '',
        kind,
        mediaURL: input.mediaURL ?? null,
        duration: input.duration ?? null,
        samples: (input.samples as never) ?? undefined,
        emphasis: input.emphasis ?? null,
      },
    });

    // Preview line: media has no text of its own, so name the kind instead of
    // leaving the thread list blank.
    const preview =
      kind === 'image' ? 'Photo' : kind === 'voice' ? 'Voice note' : (input.text ?? '');
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: preview, lastMessageAt: message.createdAt },
    });

    const shaped = this.shapeMessage(message);
    const recipient = convo.userAId === userId ? convo.userBId : convo.userAId;
    this.realtime.messageCreated(recipient, shaped);
    return shaped;
  }

  /** Tombstones a message. Sender-only, and only their own. */
  async unsendMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Not your message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { unsent: true, text: '', mediaURL: null, duration: null, samples: undefined },
    });

    const convo = await this.prisma.conversation.findUnique({ where: { id: message.conversationId } });
    if (convo) {
      const recipient = convo.userAId === userId ? convo.userBId : convo.userAId;
      this.realtime.messageCreated(recipient, this.shapeMessage(updated));
    }
    return this.shapeMessage(updated);
  }

  async setMuted(conversationId: string, userId: string, isMuted: boolean) {
    await this.requireMembership(conversationId, userId);
    await this.prisma.conversationState.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: { isMuted },
      create: { conversationId, userId, isMuted },
    });
    return {};
  }

  async setArchived(conversationId: string, userId: string, isArchived: boolean) {
    await this.requireMembership(conversationId, userId);
    await this.prisma.conversationState.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: { isArchived },
      create: { conversationId, userId, isArchived },
    });
    return {};
  }

  /**
   * Delete is per-user: it clears the thread for the caller only. Dropping the
   * row outright would delete it from under the other participant too, which
   * is not what "delete this conversation" means in a two-person chat.
   */
  async clearConversation(conversationId: string, userId: string) {
    await this.requireMembership(conversationId, userId);
    const now = new Date();
    await this.prisma.conversationState.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: { clearedAt: now, isArchived: false },
      create: { conversationId, userId, clearedAt: now },
    });
    return {};
  }
}
