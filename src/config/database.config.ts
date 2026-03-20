import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
config();

const dbConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  // port: parseInt(process.env.DB_PORT ?? '5432'),
  // username: process.env.DB_USER,
  // password: process.env.DB_PASS,
  // database: process.env.DB_NAME,
  url: process.env.DATABASE_URL,
  autoLoadEntities: true,
  synchronize: false,
  migrationsRun: true,
  logging: true,
  migrations: ['dist/database/migrations/*.js'],
  ssl: {
    rejectUnauthorized: false,
  },
};

export default dbConfig;
