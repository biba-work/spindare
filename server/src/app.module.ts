import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ProfilesModule } from './profiles/profiles.module';
import { PostsModule } from './posts/posts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SocialModule } from './social/social.module';
import { ChallengesModule } from './challenges/challenges.module';
import { StorageModule } from './storage/storage.module';
import { SearchModule } from './search/search.module';
import { ChatModule } from './chat/chat.module';

// Note: the old FeedModule (src/feed) that shipped with the original
// scaffold — hardcoded mock data, no database — is no longer wired in here.
// PostsModule (GET /posts) is the real feed now. The feed/ folder can be
// deleted whenever you get to it; leaving it on disk for now doesn't hurt
// anything since it's not imported.
@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    ProfilesModule,
    PostsModule,
    NotificationsModule,
    SocialModule,
    ChallengesModule,
    StorageModule,
    SearchModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
