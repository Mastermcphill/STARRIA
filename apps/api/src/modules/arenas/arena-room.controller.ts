import {
  Controller, Post, Delete, Param, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ArenaRoomService } from './arena-room.service';
import { Roles } from '../auth/roles.decorator';

type AuthedReq = { user: { userId: string } };

@ApiTags('arenas')
@ApiBearerAuth()
@Controller('arenas')
export class ArenaRoomController {
  constructor(private readonly rooms: ArenaRoomService) {}

  @Post(':id/room')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create the LiveKit room for a battle (admin only)' })
  createRoom(@Param('id') id: string) {
    return this.rooms.createRoom(id);
  }

  @Delete(':id/room')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tear down the LiveKit room for a battle (admin only)' })
  endRoom(@Param('id') id: string) {
    return this.rooms.endRoom(id);
  }

  @Post(':id/room/token')
  @ApiOperation({ summary: 'Get a publisher token (battle participants only)' })
  participantToken(@Request() req: AuthedReq, @Param('id') id: string) {
    return this.rooms.issueParticipantToken(id, req.user.userId);
  }

  @Post(':id/room/spectator-token')
  @ApiOperation({ summary: 'Get a subscribe-only spectator token' })
  spectatorToken(@Request() req: AuthedReq, @Param('id') id: string) {
    return this.rooms.issueSpectatorToken(id, req.user.userId);
  }

  @Post(':id/room/host-token')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a host/operator publisher token (admin only)' })
  hostToken(@Request() req: AuthedReq, @Param('id') id: string) {
    return this.rooms.issueHostToken(id, req.user.userId);
  }
}
