import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SocialService } from './social.service';

@Controller('social')
@UseGuards(ClerkAuthGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Post('follow/:targetId')
  follow(@CurrentUser() userId: string, @Param('targetId') targetId: string, @Body() body: { username: string; avatar: string | null }) {
    return this.social.followUser(userId, targetId, body.username, body.avatar);
  }

  @Delete('follow/:targetId')
  unfollow(@CurrentUser() userId: string, @Param('targetId') targetId: string) {
    return this.social.unfollowUser(userId, targetId);
  }

  @Get('follow/:targetId/status')
  async followStatus(@CurrentUser() userId: string, @Param('targetId') targetId: string) {
    const [following, requested] = await Promise.all([
      this.social.checkIsFollowing(userId, targetId),
      this.social.checkIsRequested(userId, targetId),
    ]);
    return { following, requested };
  }

  @Get('follow-stats/:userId')
  followStats(@Param('userId') userId: string) {
    return this.social.getFollowStats(userId);
  }

  @Get('friends')
  friends(@CurrentUser() userId: string) {
    return this.social.getFriends(userId);
  }

  @Get('requests')
  requests(@CurrentUser() userId: string) {
    return this.social.listPendingRequests(userId);
  }

  @Post('requests/:requesterId/accept')
  accept(@CurrentUser() userId: string, @Param('requesterId') requesterId: string, @Body() body: { username: string; avatar: string | null }) {
    return this.social.acceptConnectionRequest(userId, requesterId, body.username, body.avatar);
  }

  @Post('requests/:requesterId/decline')
  decline(@CurrentUser() userId: string, @Param('requesterId') requesterId: string) {
    return this.social.declineConnectionRequest(userId, requesterId);
  }

  @Post('ghost/:targetId')
  ghost(@CurrentUser() userId: string, @Param('targetId') targetId: string) {
    return this.social.ghostUser(userId, targetId);
  }

  @Delete('ghost/:targetId')
  unghost(@CurrentUser() userId: string, @Param('targetId') targetId: string) {
    return this.social.unghostUser(userId, targetId);
  }

  @Get('ghosted')
  ghostedList(@CurrentUser() userId: string) {
    return this.social.getGhostedUsers(userId);
  }

  @Get('ghosted/:targetId/status')
  async ghostStatus(@CurrentUser() userId: string, @Param('targetId') targetId: string) {
    const [ghosted, ghostedBy] = await Promise.all([
      this.social.checkIsGhosted(userId, targetId),
      this.social.checkIsGhostedBy(userId, targetId),
    ]);
    return { ghosted, ghostedBy };
  }
}
