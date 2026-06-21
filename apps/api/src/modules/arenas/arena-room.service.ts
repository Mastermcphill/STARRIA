import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveKitAdapterService } from '../live/livekit-adapter.service';

/**
 * Binds a Battle (the arena unit) to a LiveKit room and issues scoped access
 * tokens. Reuses the shared LiveKitAdapterService — there is no second LiveKit
 * client. Token capabilities:
 *   - participant (a BattleParticipant): publish audio/video + subscribe
 *   - host (operator): publish + subscribe
 *   - spectator (anyone else): subscribe only
 */
@Injectable()
export class ArenaRoomService {
  constructor(
    private readonly db: PrismaService,
    private readonly livekit: LiveKitAdapterService,
  ) {}

  /** Deterministic room name for a battle. */
  roomName(battleId: string): string {
    return `arena-battle-${battleId}`;
  }

  async createRoom(battleId: string) {
    const battle = await this.requireOpenBattle(battleId);
    const room = this.roomName(battle.id);
    // maxParticipants 0 = unlimited, so spectator count is not capped by the
    // battle's participant limit.
    await this.livekit.createRoom(room, 0);
    return { room, battleId: battle.id, status: 'created' as const };
  }

  async endRoom(battleId: string) {
    const room = this.roomName(battleId);
    await this.livekit.deleteRoom(room);
    return { room, battleId, deleted: true };
  }

  /** Token for a battle participant — may publish audio/video. */
  async issueParticipantToken(battleId: string, userId: string) {
    const battle = await this.requireOpenBattle(battleId);
    const star = await this.db.starProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!star) {
      throw new ForbiddenException('Only battle participants can publish; you have no star profile');
    }
    const participant = await this.db.battleParticipant.findUnique({
      where: { battleId_starProfileId: { battleId: battle.id, starProfileId: star.id } },
      select: { role: true },
    });
    if (!participant) {
      throw new ForbiddenException('You are not a participant in this battle — use the spectator token');
    }

    const room = this.roomName(battle.id);
    const token = await this.livekit.generateToken({
      roomName: room,
      identity: userId,
      canPublish: true,
      canSubscribe: true,
    });
    return { token, room, role: participant.role, canPublish: true, canSubscribe: true };
  }

  /** Subscribe-only token for any authenticated viewer. */
  async issueSpectatorToken(battleId: string, userId: string) {
    const battle = await this.requireOpenBattle(battleId);
    const room = this.roomName(battle.id);
    const token = await this.livekit.generateToken({
      roomName: room,
      // Namespaced identity so a spectator never collides with a participant
      // identity (which would let LiveKit drop the publisher).
      identity: `spectator-${userId}`,
      canPublish: false,
      canSubscribe: true,
    });
    return { token, room, role: 'SPECTATOR' as const, canPublish: false, canSubscribe: true };
  }

  /** Host/operator token — publish + subscribe. Caller is authorised by the
   * controller (@Roles(ADMIN)). */
  async issueHostToken(battleId: string, userId: string) {
    const battle = await this.requireOpenBattle(battleId);
    const room = this.roomName(battle.id);
    const token = await this.livekit.generateToken({
      roomName: room,
      identity: `host-${userId}`,
      canPublish: true,
      canSubscribe: true,
    });
    return { token, room, role: 'HOST' as const, canPublish: true, canSubscribe: true };
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async requireOpenBattle(battleId: string) {
    const battle = await this.db.battle.findUnique({
      where: { id: battleId },
      select: { id: true, status: true },
    });
    if (!battle) throw new NotFoundException(`Battle ${battleId} not found`);
    if (battle.status === 'DRAFT') {
      throw new BadRequestException('Arena room is not open while the battle is in DRAFT');
    }
    return battle;
  }
}
