import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';

// One Clerk client for the whole process — verifyToken() internally caches
// the JWKS fetch, so this is cheap to reuse per-request.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export interface AuthedRequest extends Request {
  userId: string;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      // verifyToken checks signature against Clerk's JWKS, expiry, and issuer.
      // No Clerk JWT "template" needed — this is Clerk's own session token,
      // the same one you already get from useAuth().getToken() with no
      // template argument.
      const { sub } = await clerk.verifyToken(token);
      req.userId = sub;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
