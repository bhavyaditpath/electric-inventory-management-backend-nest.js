import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SeederService } from './seeder/seeder.service';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const seederService = app.get(SeederService);
  // await seederService.seed();

  app.enableCors({
    origin: [
      'http://localhost:3005', // local frontend
      // add your deployed frontend URL here later
      'https://electric-inventory-management-front-ten.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Server running on port ${port}`);
}
bootstrap();
