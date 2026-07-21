import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ApnsService } from './apns.service';

@Module({
  controllers: [NotificationsController],
  providers: [ApnsService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
