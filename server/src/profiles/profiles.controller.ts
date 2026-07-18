import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
@UseGuards(ClerkAuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  // Fetch any user's profile by id (e.g. viewing someone else's page).
  @Get(':id')
  get(@Param('id') id: string) {
    return this.profiles.getProfile(id);
  }

  // Fetch the signed-in user's own profile.
  @Get()
  getOwn(@CurrentUser() userId: string) {
    return this.profiles.getProfile(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: { username?: string; email?: string; photoURL?: string; hobbies?: unknown; studyFields?: unknown },
  ) {
    return this.profiles.createProfile(userId, body);
  }

  @Patch('progress')
  updateProgress(@CurrentUser() userId: string, @Body() body: { xp: number; level: number }) {
    return this.profiles.updateProgress(userId, body.xp, body.level);
  }

  @Patch('spinner')
  updateSpinner(
    @CurrentUser() userId: string,
    @Body() body: { spinsLeft: number; lastSpinTimestamp: number },
  ) {
    return this.profiles.updateSpinnerState(userId, body.spinsLeft, body.lastSpinTimestamp);
  }

  @Patch('picture')
  updatePicture(@CurrentUser() userId: string, @Body() body: { photoURL: string }) {
    return this.profiles.updateProfilePicture(userId, body.photoURL);
  }

  @Patch('username')
  updateUsername(@CurrentUser() userId: string, @Body() body: { username: string }) {
    return this.profiles.updateUsername(userId, body.username);
  }

  @Patch('push-token')
  registerPushToken(@CurrentUser() userId: string, @Body() body: { pushToken: string }) {
    return this.profiles.registerPushToken(userId, body.pushToken);
  }

  @Patch('privacy')
  updatePrivacy(@CurrentUser() userId: string, @Body() body: { privacy: 'open' | 'private' }) {
    return this.profiles.updateConnectionPrivacy(userId, body.privacy);
  }
}
