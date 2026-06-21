import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// Prisma + Redis are @Global, so no imports are required here.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
