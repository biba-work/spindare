import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

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
}
