import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for your Next.js frontend
  app.enableCors();
  
  // Listen on Vercel's assigned port, or default to 3000 for local development
  await app.listen(process.env.PORT || 3000);
}
bootstrap();