// ---------------------------------------------------------------------------
// FraudSignalsAdapter — AI Brain fraud signals (stub).
// Returns a trust score in [0,1] and a "suspected" flag. Replace with a real
// AI Brain client; the contract (FraudSignalPort) is what the tap engine uses.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface FraudEvaluation {
  readonly trustScore: number; // 0..1
  readonly suspected: boolean;
}

export interface FraudSignalPort {
  evaluate(params: { userId: string; videoId: string }): Promise<FraudEvaluation>;
}

const RAPID_WINDOW_MS = 10_000;
const RAPID_TAP_THRESHOLD = 8; // > this many taps in the window ⇒ suspected

@Injectable()
export class FraudSignalsAdapter implements FraudSignalPort {
  constructor(private readonly db: PrismaService) {}

  async evaluate(params: { userId: string; videoId: string }): Promise<FraudEvaluation> {
    const user = await this.db.user.findUnique({
      where: { id: params.userId },
      select: { createdAt: true, role: true },
    });

    // Base trust from account maturity (older accounts are more trusted).
    const ageDays = user ? (Date.now() - user.createdAt.getTime()) / 86_400_000 : 0;
    const maturity = Math.min(1, ageDays / 30);
    let trustScore = 0.5 + 0.5 * maturity; // [0.5, 1.0] for existing accounts

    // Rapid-fire detection across this user's recent taps (any video).
    const since = new Date(Date.now() - RAPID_WINDOW_MS);
    const recentTaps = await this.db.contentTap.count({
      where: { userId: params.userId, createdAt: { gte: since } },
    });
    const suspected = recentTaps > RAPID_TAP_THRESHOLD;
    if (suspected) trustScore = Math.min(trustScore, 0.05);

    return { trustScore, suspected };
  }
}
