import { Module } from '@nestjs/common';
import { ArenasController } from './arenas.controller';
import { ArenasService } from './arenas.service';

@Module({
  controllers: [ArenasController],
  providers: [ArenasService],
  exports: [ArenasService],
})
export class ArenasModule {}
