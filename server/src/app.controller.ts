import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    // Reports *whether* each integration is configured — booleans only, never
    // the values. Without this there's no way to tell a deployed instance that
    // is missing its storage credentials from one that has them: uploads just
    // fail at runtime and the client swallows it, which reads to a user as
    // "nothing saves" with nothing to point at.
    return {
      status: 'ok',
      service: 'spindare-api',
      configured: {
        database: !!process.env.DATABASE_URL,
        clerk: !!process.env.CLERK_SECRET_KEY,
        storage:
          !!process.env.STORAGE_ENDPOINT &&
          !!process.env.STORAGE_BUCKET &&
          !!process.env.STORAGE_ACCESS_KEY_ID &&
          !!process.env.STORAGE_SECRET_ACCESS_KEY &&
          !!process.env.STORAGE_PUBLIC_URL,
        storagePublicUrl: !!process.env.STORAGE_PUBLIC_URL,
      },
    };
  }
}
