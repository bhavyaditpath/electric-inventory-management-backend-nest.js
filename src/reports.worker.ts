import { NestFactory } from '@nestjs/core';
import { ReportsWorkerModule } from './reports.worker.module';

async function bootstrap() {
  process.env.REPORTS_CRON_ENABLED = 'true';
  const app = await NestFactory.createApplicationContext(ReportsWorkerModule);

  app.enableShutdownHooks();
  console.log('Reports worker is running. Cron jobs are enabled.');
}

bootstrap();
