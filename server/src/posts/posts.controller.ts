import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(ClerkAuthGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  getFeed() {
    return this.posts.getFeed();
  }

  @Get('count')
  getCount() {
    return this.posts.getPostCount();
  }

  @Post('seed')
  seed(@Body() body: { posts: Array<Record<string, unknown>> }) {
    return this.posts.seedFakeData(body.posts);
  }

  @Get('user/:userId')
  getUserPosts(@Param('userId') userId: string) {
    return this.posts.getUserPosts(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body() body: { username: string; avatar?: string; challenge: string; content?: string; media?: string },
  ) {
    return this.posts.createPost({ userId, ...body });
  }

  @Get(':postId/reaction')
  getMyReaction(@CurrentUser() userId: string, @Param('postId') postId: string) {
    return this.posts.getUserReaction(userId, postId);
  }

  @Post(':postId/reaction')
  toggleReaction(
    @CurrentUser() userId: string,
    @Param('postId') postId: string,
    @Body() body: { username: string; avatar: string | null; type: 'felt' | 'thought' | 'intrigued' },
  ) {
    return this.posts.toggleReaction({ userId, postId, ...body });
  }

  @Get(':postId/comments')
  getComments(@Param('postId') postId: string) {
    return this.posts.getComments(postId);
  }

  @Post(':postId/comments')
  addComment(
    @CurrentUser() userId: string,
    @Param('postId') postId: string,
    @Body() body: { username: string; avatar: string; text: string },
  ) {
    return this.posts.addComment({ userId, postId, ...body });
  }
}
