import { Module } from '@nestjs/common';
import { ArenasController } from './arenas.controller';
import { ArenasService } from './arenas.service';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { ArenaRoomController } from './arena-room.controller';
import { ArenaRoomService } from './arena-room.service';
import { LiveModule } from '../live/live.module';

@Module({
  imports: [LiveModule],
  controllers: [ArenasController, BattlesController, ArenaRoomController],
  providers: [ArenasService, BattlesService, ArenaRoomService],
  exports: [ArenasService, BattlesService],
})
export class ArenasModule {}
