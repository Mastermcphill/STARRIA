import { Module } from '@nestjs/common';
import { PosterController } from './poster.controller';
import { PosterService } from './poster.service';
import { PrismaTicketRepository } from '../ticketing/prisma-ticket-store.repository';

@Module({
  controllers: [PosterController],
  providers: [PosterService, PrismaTicketRepository],
  exports: [PosterService],
})
export class PosterModule {}
