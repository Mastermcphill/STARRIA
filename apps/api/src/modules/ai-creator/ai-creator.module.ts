import { Module } from '@nestjs/common';
import { AiCreatorController } from './ai-creator.controller';
import { AiCreatorService } from './ai-creator.service';

@Module({
  controllers: [AiCreatorController],
  providers: [AiCreatorService],
  exports: [AiCreatorService],
})
export class AiCreatorModule {}
