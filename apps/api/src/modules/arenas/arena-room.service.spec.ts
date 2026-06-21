import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArenaRoomService } from './arena-room.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveKitAdapterService } from '../live/livekit-adapter.service';

describe('ArenaRoomService', () => {
  let svc: ArenaRoomService;
  let db: any;
  let livekit: any;

  beforeEach(() => {
    db = {
      battle: { findUnique: jest.fn() },
      starProfile: { findUnique: jest.fn() },
      battleParticipant: { findUnique: jest.fn() },
    };
    livekit = {
      createRoom: jest.fn(async () => undefined),
      deleteRoom: jest.fn(async () => undefined),
      generateToken: jest.fn(async () => 'jwt-token'),
    };
    svc = new ArenaRoomService(db as PrismaService, livekit as LiveKitAdapterService);
  });

  const openBattle = { id: 'b1', status: 'ACTIVE' };

  it('derives a deterministic room name', () => {
    expect(svc.roomName('b1')).toBe('arena-battle-b1');
  });

  it('404s when the battle does not exist', async () => {
    db.battle.findUnique.mockResolvedValue(null);
    await expect(svc.issueSpectatorToken('b1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to open a room for a DRAFT battle', async () => {
    db.battle.findUnique.mockResolvedValue({ id: 'b1', status: 'DRAFT' });
    await expect(svc.createRoom('b1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('issues a publisher token to a participant', async () => {
    db.battle.findUnique.mockResolvedValue(openBattle);
    db.starProfile.findUnique.mockResolvedValue({ id: 'sp1' });
    db.battleParticipant.findUnique.mockResolvedValue({ role: 'CHALLENGER' });
    const res = await svc.issueParticipantToken('b1', 'u1');
    expect(res.canPublish).toBe(true);
    expect(res.role).toBe('CHALLENGER');
    expect(livekit.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ identity: 'u1', canPublish: true, canSubscribe: true, roomName: 'arena-battle-b1' }),
    );
  });

  it('forbids a non-participant from a publisher token', async () => {
    db.battle.findUnique.mockResolvedValue(openBattle);
    db.starProfile.findUnique.mockResolvedValue({ id: 'sp1' });
    db.battleParticipant.findUnique.mockResolvedValue(null);
    await expect(svc.issueParticipantToken('b1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues a subscribe-only spectator token with a namespaced identity', async () => {
    db.battle.findUnique.mockResolvedValue(openBattle);
    const res = await svc.issueSpectatorToken('b1', 'u9');
    expect(res.canPublish).toBe(false);
    expect(res.canSubscribe).toBe(true);
    expect(res.role).toBe('SPECTATOR');
    expect(livekit.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ identity: 'spectator-u9', canPublish: false, canSubscribe: true }),
    );
  });

  it('issues a host token (publish) with a namespaced identity', async () => {
    db.battle.findUnique.mockResolvedValue(openBattle);
    const res = await svc.issueHostToken('b1', 'op1');
    expect(res.role).toBe('HOST');
    expect(res.canPublish).toBe(true);
    expect(livekit.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ identity: 'host-op1', canPublish: true }),
    );
  });

  it('creates and tears down the room via the shared adapter', async () => {
    db.battle.findUnique.mockResolvedValue(openBattle);
    await svc.createRoom('b1');
    expect(livekit.createRoom).toHaveBeenCalledWith('arena-battle-b1', 0);
    await svc.endRoom('b1');
    expect(livekit.deleteRoom).toHaveBeenCalledWith('arena-battle-b1');
  });
});
