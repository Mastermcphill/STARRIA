import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ModerationModule } from '../moderation/moderation.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ModerationModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
