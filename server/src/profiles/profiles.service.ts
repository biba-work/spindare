import { Injectable, NotFoundException } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ProfilesService {
  // Own Clerk client for server-side user deletion — same secret-key auth the
  // ClerkAuthGuard uses. Constructed at instantiation (after dotenv loads env
  // in main.ts), not at module-eval time.
  private clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  // Serializes BigInt fields (lastSpinTimestamp) to number since JSON.stringify
  // can't handle BigInt natively — matches what the mobile client expects
  // (it was a plain number from PostgREST/Supabase before).
  private serialize(profile: any) {
    if (!profile) return profile;
    return { ...profile, lastSpinTimestamp: Number(profile.lastSpinTimestamp) };
  }

  async getProfile(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    return this.serialize(profile);
  }

  async createProfile(id: string, data: {
    username?: string;
    email?: string;
    photoURL?: string;
    hobbies?: unknown;
    studyFields?: unknown;
  }) {
    const profile = await this.prisma.profile.upsert({
      where: { id },
      update: {},
      create: {
        id,
        username: data.username,
        email: data.email,
        photoURL: data.photoURL,
        hobbies: (data.hobbies as any) ?? [],
        studyFields: (data.studyFields as any) ?? [],
      },
    });
    return this.serialize(profile);
  }

  async updateProgress(id: string, xp: number, level: number) {
    const profile = await this.prisma.profile.update({
      where: { id },
      data: { xp, level },
    });
    this.realtime.profileUpdated(this.serialize(profile));
    return this.serialize(profile);
  }

  async updateSpinnerState(id: string, spinsLeft: number, lastSpinTimestamp: number) {
    const profile = await this.prisma.profile.update({
      where: { id },
      data: { spinsLeft, lastSpinTimestamp: BigInt(lastSpinTimestamp) },
    });
    this.realtime.profileUpdated(this.serialize(profile));
    return this.serialize(profile);
  }

  async updateProfilePicture(id: string, photoURL: string) {
    const profile = await this.prisma.profile.update({ where: { id }, data: { photoURL } });
    this.realtime.profileUpdated(this.serialize(profile));
    return this.serialize(profile);
  }

  async updateUsername(id: string, username: string) {
    const profile = await this.prisma.profile.update({ where: { id }, data: { username } });
    // Original behavior: also relabel this user's past posts with the new name.
    await this.prisma.post.updateMany({ where: { userId: id }, data: { author: username } });
    this.realtime.profileUpdated(this.serialize(profile));
    return this.serialize(profile);
  }

  async registerPushToken(id: string, pushToken: string) {
    const profile = await this.prisma.profile.update({ where: { id }, data: { pushToken } });
    return this.serialize(profile);
  }

  async updateConnectionPrivacy(id: string, privacy: 'open' | 'private') {
    const profile = await this.prisma.profile.update({
      where: { id },
      data: { connectionPrivacy: privacy },
    });
    return this.serialize(profile);
  }

  async findById(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profile not found');
    return this.serialize(profile);
  }

  /// Permanently removes a user: every row they own across the app, then the
  /// profile itself, then the Clerk account. Only some tables FK-cascade off the
  /// profile delete (ConnectionRequest.requester, Notification.fromUser,
  /// SentChallenge.fromUser) — everything else, plus the "receiver/to" sides,
  /// has no FK by design, so it's deleted explicitly here. Runs in a transaction
  /// so a partial delete can't leave the account half-gone.
  async deleteAccount(id: string) {
    await this.prisma.$transaction([
      // Posts first — their reactions and comments FK-cascade off the post.
      this.prisma.post.deleteMany({ where: { userId: id } }),
      // This user's reactions/comments on *other* people's posts.
      this.prisma.reaction.deleteMany({ where: { userId: id } }),
      this.prisma.comment.deleteMany({ where: { userId: id } }),
      this.prisma.follow.deleteMany({
        where: { OR: [{ followerId: id }, { followingId: id }] },
      }),
      this.prisma.connectionRequest.deleteMany({
        where: { OR: [{ requesterId: id }, { receiverId: id }] },
      }),
      this.prisma.ghostedUser.deleteMany({
        where: { OR: [{ userId: id }, { ghostedId: id }] },
      }),
      this.prisma.notification.deleteMany({
        where: { OR: [{ userId: id }, { fromUserId: id }] },
      }),
      this.prisma.keptChallenge.deleteMany({ where: { userId: id } }),
      this.prisma.spindChallenge.deleteMany({ where: { userId: id } }),
      this.prisma.sentChallenge.deleteMany({
        where: { OR: [{ fromUserId: id }, { toUserId: id }] },
      }),
      this.prisma.profile.deleteMany({ where: { id } }),
    ]);

    // Best-effort: the DB rows are already gone; a Clerk hiccup shouldn't make
    // the whole delete look failed to the client (they can't sign in to a
    // profile-less account anyway).
    try {
      await this.clerk.users.deleteUser(id);
    } catch {
      // swallow — DB deletion is the source of truth for "account gone"
    }

    return { deleted: true };
  }
}
