import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NestSessionEngineService } from './session-engine.service';
import type {
  CreateRoomInput,
  JoinRoomInput,
  InviteInput,
  ModerateInput,
} from '@starria/session-engine-core';

// ---------------------------------------------------------------------------
// Unified room engine — covers live events, companion sessions, battles, etc.
// ---------------------------------------------------------------------------
@ApiTags('session-engine')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly svc: NestSessionEngineService) {}

  @Post()
  @ApiOperation({ summary: 'Create a unified session room of any type' })
  async create(@Body() body: CreateRoomInput) {
    if (!body?.roomType || !body?.hostId) throw new BadRequestException('roomType and hostId required');
    return this.svc.engine.createRoom(body);
  }

  @Get()
  @ApiOperation({ summary: 'List rooms (optionally filter by status/type)' })
  async list(@Query('status') status?: any, @Query('roomType') roomType?: any) {
    return this.svc.engine.listRooms({ status, roomType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room with participants' })
  async get(@Param('id') id: string) {
    const room = await this.svc.engine.getRoom(id);
    if (!room) throw new NotFoundException('Room not found');
    const participants = await this.svc.engine.listParticipants(id);
    return { room, participants };
  }

  @Post(':id/open')
  @ApiOperation({ summary: 'Open a room for joining' })
  open(@Param('id') id: string) { return this.svc.engine.openRoom(id); }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a room (goes LIVE, auto-records if enabled)' })
  start(@Param('id') id: string) { return this.svc.engine.startRoom(id); }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a live room' })
  pause(@Param('id') id: string) { return this.svc.engine.pauseRoom(id); }

  @Post(':id/end')
  @ApiOperation({ summary: 'End a room and settle revenue' })
  end(@Param('id') id: string) { return this.svc.engine.endRoom(id); }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a room' })
  cancel(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.svc.engine.cancelRoom(id, body?.reason);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a room — enforces cap + billing, returns LiveKit token' })
  join(@Param('id') id: string, @Body() body: Omit<JoinRoomInput, 'roomId'>) {
    if (!body?.userId) throw new BadRequestException('userId required');
    return this.svc.engine.joinRoom({ roomId: id, ...body });
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a room' })
  async leave(@Param('id') id: string, @Body() body: { userId: string }) {
    await this.svc.engine.leaveRoom(id, body.userId);
    return { ok: true };
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a participant with a role' })
  invite(@Param('id') id: string, @Body() body: Omit<InviteInput, 'roomId'>) {
    return this.svc.engine.invite({ roomId: id, ...body });
  }

  @Post(':id/moderate')
  @ApiOperation({ summary: 'Apply a moderation action (warn/mute/kick/ban/flag)' })
  moderate(@Param('id') id: string, @Body() body: Omit<ModerateInput, 'roomId'>) {
    return this.svc.engine.moderate({ roomId: id, ...body });
  }
}

// ---------------------------------------------------------------------------
// Recording endpoints (Phase 9 contract: /sessions/:id/record, stop-recording)
// ---------------------------------------------------------------------------
@ApiTags('session-engine')
@Controller('sessions')
export class SessionRecordingController {
  constructor(private readonly svc: NestSessionEngineService) {}

  @Post(':id/record')
  @ApiOperation({ summary: 'Start recording a session room' })
  async record(@Param('id') id: string) {
    return this.svc.engine.startRecording(id);
  }

  @Post(':id/stop-recording')
  @ApiOperation({ summary: 'Stop recording a session room' })
  async stopRecording(@Param('id') id: string) {
    return this.svc.engine.stopRecording(id);
  }

  @Get(':id/recording')
  @ApiOperation({ summary: 'Get the current recording for a room' })
  async recording(@Param('id') id: string) {
    const rec = await this.svc.engine.getRecordingByRoom(id);
    if (!rec) throw new NotFoundException('No recording for this room');
    return rec;
  }
}
