// ---------------------------------------------------------------------------
// session-engine — Billing ledger adapter + LiveKit provider stub.
// The session-engine STORE is now Prisma-backed (see
// prisma-session-engine.repository.ts). The remaining adapters are the coin
// billing ledger (deliberately a wallet-adapter stub with a `seed()` test
// helper) and the LiveKit provider stub (replaced by real LiveKit wiring in a
// later infra sprint). See the Sprint 10 audit.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { SessionBillingPort, LiveKitProviderPort } from '@starria/session-engine-core';

const COIN_BALANCES = new Map<string, number>();
const DEFAULT_BALANCE = 100_000;

@Injectable()
export class InMemorySessionBilling implements SessionBillingPort {
  /** Test helper: seed a balance. */
  seed(userId: string, coins: number): void {
    COIN_BALANCES.set(userId, coins);
  }
  getBalance(userId: string): number {
    return COIN_BALANCES.get(userId) ?? DEFAULT_BALANCE;
  }
  async charge(userId: string, coins: number, _reason: string): Promise<void> {
    const cur = COIN_BALANCES.get(userId) ?? DEFAULT_BALANCE;
    if (cur < coins) throw new Error('Insufficient coins');
    COIN_BALANCES.set(userId, cur - coins);
  }
  async settle(_roomId: string, creatorId: string, grossCoins: number, platformFeePct: number) {
    const platformCoins = Math.floor((grossCoins * platformFeePct) / 100);
    const creatorCoins = grossCoins - platformCoins;
    COIN_BALANCES.set(creatorId, (COIN_BALANCES.get(creatorId) ?? DEFAULT_BALANCE) + creatorCoins);
    return { creatorCoins, platformCoins };
  }
}

/**
 * Stub LiveKit provider — real LiveKit server wiring (room provisioning, JWT
 * tokens, egress) lands behind this port in a later infra sprint. Tokens are
 * deterministic placeholders; egress returns a synthetic asset URL.
 */
@Injectable()
export class StubLiveKitProvider implements LiveKitProviderPort {
  async createRoom(_roomName: string, _maxParticipants: number): Promise<void> {
    // no-op; real impl calls LiveKit RoomService.createRoom
  }
  async issueToken(roomName: string, identity: string, canPublish: boolean): Promise<string> {
    return `livekit-token:${roomName}:${identity}:${canPublish ? 'pub' : 'sub'}`;
  }
  async startEgress(roomName: string): Promise<{ egressId: string }> {
    return { egressId: `egress_${roomName}_${Date.now()}` };
  }
  async stopEgress(egressId: string): Promise<{ assetUrl: string; durationSeconds: number }> {
    return { assetUrl: `https://cdn.starria.local/recordings/${egressId}.mp4`, durationSeconds: 0 };
  }
  async deleteRoom(_roomName: string): Promise<void> {
    // no-op
  }
}
