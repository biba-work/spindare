import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChallengesService } from './challenges.service';

@Controller('challenges')
@UseGuards(ClerkAuthGuard)
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get('kept')
  listKept(@CurrentUser() userId: string) {
    return this.challenges.listKeptForUser(userId);
  }

  @Get('kept/saved')
  saved(@CurrentUser() userId: string) {
    return this.challenges.getSavedChallenges(userId);
  }

  @Post('kept/toggle')
  toggleKept(@CurrentUser() userId: string, @Body() body: { postId: string; challenge: string }) {
    return this.challenges.toggleKeptChallenge(userId, body.postId, body.challenge);
  }

  @Post('kept/save')
  save(@CurrentUser() userId: string, @Body() body: { challenge: string; postId?: string }) {
    return this.challenges.saveChallenge(userId, body.challenge, body.postId);
  }

  @Get('spind')
  listSpind(@CurrentUser() userId: string) {
    return this.challenges.listSpindForUser(userId);
  }

  @Post('spind')
  recordSpind(@CurrentUser() userId: string, @Body() body: { postId: string; challenge: string }) {
    return this.challenges.recordSpindChallenge(userId, body.postId, body.challenge);
  }

  // --- Spind inbox: challenges friends send you ---

  @Get('spind/inbox')
  spindInbox(@CurrentUser() userId: string) {
    return this.challenges.listSpindInbox(userId);
  }

  @Post('spind/send')
  sendSpind(@CurrentUser() userId: string, @Body() body: { toUserId: string; challenge: string }) {
    return this.challenges.sendSpindChallenge(userId, body.toUserId, body.challenge);
  }

  @Post('spind/:id/accept')
  acceptSpind(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.challenges.acceptSpind(userId, id);
  }

  @Post('spind/:id/decline')
  declineSpind(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.challenges.declineSpind(userId, id);
  }
}
