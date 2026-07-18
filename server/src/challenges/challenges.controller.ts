import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
}
