import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const extraOrigins = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = [
        'https://expense-tracker-tjv1-amber.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
        ...extraOrigins,
      ];
      const isAllowed =
        allowed.includes(origin) ||
        origin.endsWith('.vercel.app');
      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'Accept'],
  });
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
