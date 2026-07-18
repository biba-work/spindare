import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(ClerkAuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('users')
  users(@Query('q') q: string) {
    return this.search.searchUsers(q ?? '');
  }

  @Get('challenges')
  challenges(@Query('q') q: string) {
    return this.search.searchChallenges(q ?? '');
  }
}
