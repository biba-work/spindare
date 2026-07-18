import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ProfilesService {
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
}
