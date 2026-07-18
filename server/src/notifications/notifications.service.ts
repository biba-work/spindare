import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  // Mirrors NotificationService.sendNotification's signature from the mobile
  // client so PostsService/ReactionsService/CommentsService can call it the
  // same way they used to call the Supabase version directly.
  async sendNotification(
    toUserId: string,
    type: string,
    content: string,
    fromUserId: string,
    fromUsername: string,
    _fromAvatar: string | null,
    targetId?: string,
  ) {
    // Don't notify yourself (e.g. reacting to your own post).
    if (toUserId === fromUserId) return null;

    const notification = await this.prisma.notification.create({
      data: {
        userId: toUserId,
        type,
        fromUserId,
        content,
        targetId,
      },
      include: { fromUser: true },
    });

    this.realtime.notificationCreated(toUserId, notification);

    // Best-effort push via Expo's push service — same endpoint the mobile
    // client's expo-notifications setup already expects, just triggered
    // server-side now instead of from NotificationService.ts directly.
    this.sendExpoPush(toUserId, fromUsername, content, type, targetId).catch(() => undefined);

    return notification;
  }

  private async sendExpoPush(toUserId: string, fromUsername: string, content: string, type: string, targetId?: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: toUserId } });
    if (!profile?.pushToken) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.pushToken,
        sound: 'default',
        title: `@${fromUsername}`,
        body: content,
        data: { type, targetId: targetId ?? null },
      }),
    });
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      include: { fromUser: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId }, data: { read: true } });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }
}
