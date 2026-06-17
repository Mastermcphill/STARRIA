import { Module } from '@nestjs/common';
import { TapsController } from './taps.controller';
import { TapsService } from './taps.service';

@Module({
  controllers: [TapsController],
  providers: [TapsService],
  exports: [TapsService],
})
export class TapsModule {}
