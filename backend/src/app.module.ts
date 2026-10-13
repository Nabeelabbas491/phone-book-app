import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsModule } from './contacts/contacts.module';
import { buildDataSourceOptions } from './database/database.config';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      // Evaluated after ConfigModule has loaded .env into process.env
      useFactory: () => ({ ...buildDataSourceOptions(), retryAttempts: 10, retryDelay: 3000 }),
    }),
    ContactsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
