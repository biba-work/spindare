import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_REACTIONS = { felt: 0, thought: 0, intrigued: 0 };

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private notifications: NotificationsService,
  ) {}

  async getFeed() {
    return this.prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getUserPosts(userId: string) {
    return this.prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPostCount() {
    return this.prisma.post.count();
  }

  // Dev-only bulk insert for FeedScreen's demo data — mirrors the old
  // seedFakeData()'s "only if the table is empty" guard. The client still
  // gates the *call* behind __DEV__; this is a second guard in case someone
  // calls it from a built app by mistake.
  async seedFakeData(posts: Array<Record<string, unknown>>) {
    const count = await this.prisma.post.count();
    if (count > 0) return { seeded: 0 };
    await this.prisma.post.createMany({ data: posts as any });
    return { seeded: posts.length };
  }

  async createPost(params: {
    userId: string;
    username: string;
    avatar?: string;
    challenge: string;
    content?: string;
    media?: string;
  }) {
    // Same "how many people have posted this exact challenge" spin count the
    // original PostService computed client-side.
    const existingCount = await this.prisma.post.count({
      where: { challenge: params.challenge },
    });

    const post = await this.prisma.post.create({
      data: {
        userId: params.userId,
        author: params.username,
        avatar: params.avatar,
        challenge: params.challenge,
        content: params.content,
        media: params.media,
        spinCount: existingCount + 1,
        reactions: DEFAULT_REACTIONS,
      },
    });

    this.realtime.postCreated(post);

    // Fire-and-forget, matches original "never block the post" behavior.
    this.updateStreak(params.userId).catch(() => undefined);

    return post;
  }

  async updateStreak(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) return;

    const today = new Date().toISOString().split('T')[0];
    const last = profile.lastChallengeDate;

    let newStreak = 1;
    if (last) {
      if (last === today) return; // already posted today

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (last === yesterdayStr) newStreak = (profile.streak || 0) + 1;
      // else: streak broken, reset to 1 (default above)
    }

    await this.prisma.profile.update({
      where: { id: userId },
      data: { streak: newStreak, lastChallengeDate: today },
    });
  }

  // ---- Reactions ----

  async getUserReaction(userId: string, postId: string) {
    const reaction = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    return reaction?.type ?? null;
  }

  async toggleReaction(params: {
    userId: string;
    username: string;
    avatar: string | null;
    postId: string;
    type: 'felt' | 'thought' | 'intrigued';
  }) {
    const { userId, username, avatar, postId, type } = params;

    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    let updatedPost;

    if (existing) {
      if (existing.type === type) {
        // Remove reaction
        await this.prisma.reaction.delete({ where: { id: existing.id } });
        updatedPost = await this.adjustReactionCount(postId, type, -1);
      } else {
        // Swap reaction type
        await this.prisma.reaction.update({ where: { id: existing.id }, data: { type } });
        updatedPost = await this.adjustReactionCount(postId, existing.type, -1);
        updatedPost = await this.adjustReactionCount(postId, type, 1);
      }
    } else {
      await this.prisma.reaction.create({ data: { userId, postId, type } });
      updatedPost = await this.adjustReactionCount(postId, type, 1);

      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      if (post) {
        await this.notifications.sendNotification(
          post.userId,
          'reaction',
          `reacted with ${type} to your post`,
          userId,
          username,
          avatar,
          postId,
        );
      }
    }

    if (updatedPost) this.realtime.reactionChanged(postId, updatedPost.reactions);
    return updatedPost;
  }

  // Replaces the increment_reaction/decrement_reaction/swap_reaction Postgres
  // RPC functions from the lost Supabase project — same JSONB counter logic,
  // just done in application code instead of plpgsql.
  private async adjustReactionCount(postId: string, type: string, delta: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) return null;

    const reactions = { ...(post.reactions as Record<string, number>) };
    reactions[type] = Math.max(0, (reactions[type] ?? 0) + delta);

    return this.prisma.post.update({ where: { id: postId }, data: { reactions } });
  }

  // ---- Comments ----

  async addComment(params: {
    userId: string;
    username: string;
    avatar: string;
    postId: string;
    text: string;
  }) {
    const comment = await this.prisma.comment.create({
      data: {
        postId: params.postId,
        userId: params.userId,
        author: params.username,
        avatar: params.avatar,
        content: params.text,
      },
    });

    this.realtime.commentCreated(comment);

    const post = await this.prisma.post.findUnique({ where: { id: params.postId } });
    if (post) {
      await this.notifications.sendNotification(
        post.userId,
        'comment',
        'commented on your post',
        params.userId,
        params.username,
        params.avatar,
        params.postId,
      );
    }

    return comment;
  }

  async getComments(postId: string) {
    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
