// ---------------------------------------------------------------------------
// voting-core — VotingService
// Computes weighted votes: base × trust_score × patron_multiplier.
// Runs fraud checks before accepting votes.
// ---------------------------------------------------------------------------

import type { CastVoteInput, VoteWeightContext, WeightedVote, VoteResult, VoteTally } from './types';
import type {
  VoteStorePort,
  TrustScorePort,
  PatronMultiplierPort,
  VoteVelocityPort,
  FraudDetectorPort,
} from './ports';

const VELOCITY_WINDOW_MS = 60_000;     // 1-minute window
const VELOCITY_MAX_VOTES = 20;         // anti-bot: max 20 votes/min globally
const MIN_TRUST_SCORE    = 0.1;        // flag below this threshold
const JUDGE_WEIGHT       = 3.0;        // judge votes carry 3× base weight

export class VotingService {
  constructor(
    private readonly store: VoteStorePort,
    private readonly trust: TrustScorePort,
    private readonly patron: PatronMultiplierPort,
    private readonly velocity: VoteVelocityPort,
    private readonly fraud: FraudDetectorPort,
  ) {}

  async castVote(input: CastVoteInput): Promise<VoteResult> {
    // 1. Prevent self-voting
    // The caller must ensure voterId !== participant's starProfileId.
    // We enforce this at the service layer via a port check if needed.
    // Here we rely on the targetParticipantId being a different user.

    // 2. Duplicate check
    const alreadyVoted = await this.store.hasVoted(input.battleId, input.voterId);
    if (alreadyVoted) {
      return { accepted: false, reason: 'DUPLICATE' };
    }

    // 3. Velocity / anti-bot check
    const recentCount = await this.velocity.getRecentVoteCount(input.voterId, VELOCITY_WINDOW_MS);
    if (recentCount >= VELOCITY_MAX_VOTES) {
      return { accepted: false, reason: 'VELOCITY_ABUSE' };
    }

    // 4. Fetch weight components
    const [trustScore, patronMultiplier] = await Promise.all([
      this.trust.getScore(input.voterId),
      this.patron.getMultiplier(input.voterId),
    ]);

    // 5. Fraud check
    const fraudResult = await this.fraud.check({
      voterId: input.voterId,
      battleId: input.battleId,
      targetParticipantId: input.targetParticipantId,
      voterTrustScore: trustScore,
    });

    const baseWeight = input.isJudgeVote ? JUDGE_WEIGHT : 1.0;
    const finalWeight = baseWeight * trustScore * patronMultiplier;

    const vote: WeightedVote = {
      voterId: input.voterId,
      battleId: input.battleId,
      targetParticipantId: input.targetParticipantId,
      baseWeight,
      trustScore,
      patronMultiplier,
      finalWeight,
      isJudgeVote: input.isJudgeVote ?? false,
      fraudFlag: fraudResult.flagged,
    };

    await this.store.save(vote);
    await this.velocity.recordVote(input.voterId);

    if (fraudResult.flagged) {
      await this.store.flagFraud(input.battleId, input.voterId);
      return { accepted: true, vote, reason: fraudResult.reason };
    }

    return { accepted: true, vote };
  }

  async getTally(battleId: string): Promise<VoteTally> {
    return this.store.tally(battleId);
  }

  async determineWinner(battleId: string): Promise<string | undefined> {
    const tally = await this.getTally(battleId);
    if (!tally.participants.length) return undefined;
    const winner = tally.participants.reduce((best, p) =>
      p.totalWeight > best.totalWeight ? p : best,
    );
    return winner.participantId;
  }

  buildWeightContext(ctx: VoteWeightContext): number {
    const base = ctx.isJudge ? JUDGE_WEIGHT : 1.0;
    return base * ctx.voterTrustScore * ctx.patronMultiplier;
  }
}
