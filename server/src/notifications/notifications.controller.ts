import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(ClerkAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.notifications.listForUser(userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
