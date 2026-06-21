import { Module } from '@nestjs/common';
import { PatronsController } from './patrons.controller';
import { PatronsService } from './patrons.service';
import { PrismaPatronRepository } from './prisma-patron.repository';

@Module({
  controllers: [PatronsController],
  providers: [PatronsService, PrismaPatronRepository],
  exports: [PatronsService],
})
export class PatronsModule {}
