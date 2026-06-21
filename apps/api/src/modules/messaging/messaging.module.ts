import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { NestMessagingService } from './messaging.service';
import {
  PrismaMessageRepository,
  PrismaDMPermissionRepository,
} from './prisma-messaging.repository';

@Module({
  controllers: [MessagingController],
  providers: [
    NestMessagingService,
    PrismaMessageRepository,
    PrismaDMPermissionRepository,
  ],
  exports: [NestMessagingService],
})
export class MessagingModule {}
