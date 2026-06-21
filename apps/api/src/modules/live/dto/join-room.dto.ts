import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { LiveParticipantRole } from '@starria/live-core';

export class JoinRoomDto {
  @ApiPropertyOptional({
    description: 'Participant role',
    enum: ['HOST', 'COHOST', 'GUEST', 'MODERATOR', 'VIEWER'],
    default: 'VIEWER',
  })
  @IsOptional()
  @IsIn(['HOST', 'COHOST', 'GUEST', 'MODERATOR', 'VIEWER'])
  role?: LiveParticipantRole;
}
