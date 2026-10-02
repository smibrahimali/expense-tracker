import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Explicitly allow the frontend to bypass browser security blocks
  app.enableCors();
  
  await app.listen(process.env.PORT || 3001);
}
bootstrap();