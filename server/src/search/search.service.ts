import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchUsers(text: string) {
    const clean = text.trim();
    if (!clean) return [];
    const profiles = await this.prisma.profile.findMany({
      where: { username: { contains: clean, mode: 'insensitive' } },
      take: 10,
    });
    return profiles.map((p) => ({ ...p, uid: p.id, lastSpinTimestamp: Number(p.lastSpinTimestamp) }));
  }

  async searchChallenges(text: string) {
    const clean = text.trim();
    if (!clean) return [];
    return this.prisma.post.findMany({
      where: {
        OR: [
          { challenge: { contains: clean, mode: 'insensitive' } },
          { content: { contains: clean, mode: 'insensitive' } },
          { author: { contains: clean, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
  }
}
