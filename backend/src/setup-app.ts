import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Global configuration shared by main.ts and the e2e tests. */
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
