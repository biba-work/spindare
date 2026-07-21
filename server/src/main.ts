// Must be the very first import: clerk-auth.guard.ts builds its Clerk client
// from process.env at module-eval time (a top-level const), which runs during
// the import graph below — before bootstrap()'s body. A Nest ConfigModule
// would load too late for that. Deployed hosts inject env vars directly, so
// this only matters for local runs, but it must stay at the top.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Express defaults JSON bodies to 100 KB. `POST /storage/upload` takes a
  // base64 image, and base64 inflates bytes by a third — so every real photo
  // exceeded the cap and came back 413, which the mobile client swallowed.
  // Clients now presign and PUT straight to R2 instead, but this endpoint is
  // still reachable and shouldn't fail on size alone.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  // The mobile app is a separate origin (Expo dev server / native app), so
  // this needs to be wide open rather than same-origin-only.
  app.enableCors({ origin: '*' });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Spindare API listening on port ${port}`);
}
bootstrap();
