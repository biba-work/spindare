import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage: getFeed(@CurrentUser() userId: string) — pulls the Clerk user id
// that ClerkAuthGuard attached to the request.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.userId;
  },
);
