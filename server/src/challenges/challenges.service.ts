import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChallengesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // How long a friend-sent challenge stays in the inbox before it expires.
  private static readonly SENT_TTL_MS = 48 * 60 * 60 * 1000;

  // --- Kept challenges (two call patterns kept from the original app —
  // see the schema.prisma comment on KeptChallenge for why) ---

  // Pattern A: PostService's "keep this specific post's challenge" toggle.
  async toggleKeptChallenge(userId: string, postId: string, challenge: string) {
    const existing = await this.prisma.keptChallenge.findFirst({ where: { userId, postId } });
    if (existing) {
      await this.prisma.keptChallenge.delete({ where: { id: existing.id } });
      return false;
    }
    await this.prisma.keptChallenge.create({ data: { userId, postId, challenge } });
    return true;
  }

  // Pattern B: SocialService's "save this challenge for later" with a 2-day expiry.
  async saveChallenge(userId: string, challenge: string, postId?: string) {
    const existing = await this.prisma.keptChallenge.findFirst({ where: { userId, challenge } });
    if (existing) return; // ignoreDuplicates equivalent
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await this.prisma.keptChallenge.create({ data: { userId, challenge, postId, expiresAt } });
  }

  async getSavedChallenges(userId: string) {
    const now = new Date();
    const rows = await this.prisma.keptChallenge.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ challenge: r.challenge, expiresAt: r.expiresAt }));
  }

  async listKeptForUser(userId: string) {
    return this.prisma.keptChallenge.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  // --- Spind (sent) challenges ---

  async recordSpindChallenge(userId: string, postId: string, challenge: string) {
    return this.prisma.spindChallenge.upsert({
      where: { userId_postId: { userId, postId } },
      update: { challenge },
      create: { userId, postId, challenge },
    });
  }

  async listSpindForUser(userId: string) {
    return this.prisma.spindChallenge.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  // --- Spind inbox (friend-to-friend sent challenges) ---

  // Shapes a row to exactly the keys the mobile SpindChallenge model decodes:
  // id, challenge, fromUserId, fromUsername, fromAvatar, sentAt, expiresAt,
  // accepted. Prisma's own field names (createdAt, the fromUser relation) are
  // deliberately projected away so the client's plain Codable maps cleanly.
  private shapeSent(row: {
    id: string;
    challenge: string;
    fromUserId: string;
    accepted: boolean;
    expiresAt: Date | null;
    createdAt: Date;
    fromUser?: { username: string | null; photoURL: string | null } | null;
  }) {
    return {
      id: row.id,
      challenge: row.challenge,
      fromUserId: row.fromUserId,
      fromUsername: row.fromUser?.username ?? '',
      fromAvatar: row.fromUser?.photoURL ?? null,
      sentAt: row.createdAt,
      expiresAt: row.expiresAt,
      accepted: row.accepted,
    };
  }

  async sendSpindChallenge(fromUserId: string, toUserId: string, challenge: string) {
    const expiresAt = new Date(Date.now() + ChallengesService.SENT_TTL_MS);
    const row = await this.prisma.sentChallenge.create({
      data: { fromUserId, toUserId, challenge, expiresAt },
    });

    // Notify the recipient — sender's name/avatar come from their profile, the
    // same source PostsService uses for reaction/comment notifications.
    const sender = await this.prisma.profile.findUnique({ where: { id: fromUserId } });
    await this.notifications.sendNotification(
      toUserId,
      'spind',
      'sent you a challenge',
      fromUserId,
      sender?.username ?? 'Someone',
      sender?.photoURL ?? null,
      row.id,
    );

    return this.shapeSent({ ...row, fromUser: sender });
  }

  // Only non-expired challenges addressed to this user; newest first.
  async listSpindInbox(userId: string) {
    const rows = await this.prisma.sentChallenge.findMany({
      where: { toUserId: userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { fromUser: { select: { username: true, photoURL: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.shapeSent(r));
  }

  // The toUserId guard is what stops anyone from accepting/declining a
  // challenge that wasn't sent to them — updateMany/deleteMany simply affect
  // zero rows if the id isn't theirs, rather than throwing.
  async acceptSpind(userId: string, id: string) {
    await this.prisma.sentChallenge.updateMany({
      where: { id, toUserId: userId },
      data: { accepted: true },
    });
    return {};
  }

  async declineSpind(userId: string, id: string) {
    await this.prisma.sentChallenge.deleteMany({ where: { id, toUserId: userId } });
    return {};
  }
}
