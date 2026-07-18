import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SocialService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async followUser(currentUserId: string, targetUserId: string, fromUsername: string, fromAvatar: string | null) {
    if (currentUserId === targetUserId) throw new Error('Cannot follow self');

    const target = await this.prisma.profile.findUnique({ where: { id: targetUserId } });
    const isPrivate = target?.connectionPrivacy === 'private';

    if (isPrivate) {
      await this.prisma.connectionRequest.upsert({
        where: { requesterId_receiverId: { requesterId: currentUserId, receiverId: targetUserId } },
        update: { status: 'pending' },
        create: { requesterId: currentUserId, receiverId: targetUserId, status: 'pending' },
      });
      await this.notifications.sendNotification(
        targetUserId, 'follow', 'sent you a connection request', currentUserId, fromUsername, fromAvatar,
      );
      return 'requested' as const;
    }

    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
      update: {},
      create: { followerId: currentUserId, followingId: targetUserId },
    });
    await this.notifications.sendNotification(
      targetUserId, 'follow', 'want to Connect with you', currentUserId, fromUsername, fromAvatar,
    );
    return 'connected' as const;
  }

  async checkIsRequested(currentUserId: string, targetUserId: string) {
    const req = await this.prisma.connectionRequest.findUnique({
      where: { requesterId_receiverId: { requesterId: currentUserId, receiverId: targetUserId } },
    });
    return req?.status === 'pending';
  }

  async unfollowUser(currentUserId: string, targetUserId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId: currentUserId, followingId: targetUserId },
    });
  }

  async acceptConnectionRequest(currentUserId: string, requesterId: string, fromUsername: string, fromAvatar: string | null) {
    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId: requesterId, followingId: currentUserId } },
      update: {},
      create: { followerId: requesterId, followingId: currentUserId },
    });
    await this.prisma.connectionRequest.deleteMany({
      where: { receiverId: currentUserId, requesterId },
    });
    await this.notifications.sendNotification(
      requesterId, 'follow', 'accepted your connection request', currentUserId, fromUsername, fromAvatar,
    );
  }

  async declineConnectionRequest(currentUserId: string, requesterId: string) {
    await this.prisma.connectionRequest.deleteMany({ where: { receiverId: currentUserId, requesterId } });
  }

  async listPendingRequests(currentUserId: string) {
    const requests = await this.prisma.connectionRequest.findMany({
      where: { receiverId: currentUserId, status: 'pending' },
      include: { requester: true },
    });
    return requests.map((r) => ({
      id: r.requesterId,
      username: r.requester?.username ?? 'User',
      photoURL: r.requester?.photoURL ?? null,
      timestamp: r.createdAt,
    }));
  }

  async checkIsFollowing(currentUserId: string, targetUserId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
    });
    return !!follow;
  }

  async getFollowStats(userId: string) {
    const [followers, following] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return { followers, following };
  }

  async getFriends(currentUserId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: currentUserId },
      include: { } as any, // Follow has no direct relation to Profile in schema — resolved below.
    });
    const followingIds = rows.map((r) => r.followingId);
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: followingIds } } });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = byId.get(r.followingId);
      return {
        id: r.followingId,
        name: p?.username ?? 'User',
        username: `@${p?.username ?? 'user'}`,
        photoURL: p?.photoURL ?? undefined,
      };
    });
  }

  // ---- Ghosting ----

  async ghostUser(currentUserId: string, targetUserId: string) {
    await this.prisma.ghostedUser.upsert({
      where: { userId_ghostedId: { userId: currentUserId, ghostedId: targetUserId } },
      update: {},
      create: { userId: currentUserId, ghostedId: targetUserId },
    });
    await this.unfollowUser(currentUserId, targetUserId);
  }

  async checkIsGhosted(currentUserId: string, targetUserId: string) {
    const row = await this.prisma.ghostedUser.findUnique({
      where: { userId_ghostedId: { userId: currentUserId, ghostedId: targetUserId } },
    });
    return !!row;
  }

  async checkIsGhostedBy(currentUserId: string, targetUserId: string) {
    const row = await this.prisma.ghostedUser.findUnique({
      where: { userId_ghostedId: { userId: targetUserId, ghostedId: currentUserId } },
    });
    return !!row;
  }

  async unghostUser(currentUserId: string, targetUserId: string) {
    await this.prisma.ghostedUser.deleteMany({ where: { userId: currentUserId, ghostedId: targetUserId } });
  }

  async getGhostedUsers(currentUserId: string) {
    const rows = await this.prisma.ghostedUser.findMany({ where: { userId: currentUserId } });
    const ids = rows.map((r) => r.ghostedId);
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: ids } } });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = byId.get(r.ghostedId);
      return {
        id: r.ghostedId,
        name: p?.username ?? 'User',
        username: `@${p?.username ?? 'user'}`,
        photoURL: p?.photoURL ?? undefined,
      };
    });
  }
}
