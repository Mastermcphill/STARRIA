import { Module } from '@nestjs/common';
import { TicketingController } from './ticketing.controller';
import { TicketingService } from './ticketing.service';
import { PrismaTicketRepository } from './prisma-ticket-store.repository';

@Module({
  controllers: [TicketingController],
  providers: [TicketingService, PrismaTicketRepository],
  exports: [TicketingService],
})
export class TicketingModule {}
