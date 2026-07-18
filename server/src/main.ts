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
