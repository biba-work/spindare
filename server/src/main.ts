// Must be the very first import: clerk-auth.guard.ts builds its Clerk client
// from process.env at module-eval time (a top-level const), which runs during
// the import graph below — before bootstrap()'s body. A Nest ConfigModule
// would load too late for that. Deployed hosts inject env vars directly, so
// this only matters for local runs, but it must stay at the top.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The mobile app is a separate origin (Expo dev server / native app), so
  // this needs to be wide open rather than same-origin-only.
  app.enableCors({ origin: '*' });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Spindare API listening on port ${port}`);
}
bootstrap();
