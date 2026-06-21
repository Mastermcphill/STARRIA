// ---------------------------------------------------------------------------
// @starria/ranking-core — ELO engine, divisions, seasonal resets, decay
// ---------------------------------------------------------------------------

export type ArenaDivision = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'LEGEND';

export const DIVISION_THRESHOLDS: Record<ArenaDivision, number> = {
  BRONZE:   0,
  SILVER:   1100,
  GOLD:     1300,
  PLATINUM: 1600,
  DIAMOND:  2000,
  LEGEND:   2400,
};

// K-factor decreases as rank improves — established players change less per match.
export const K_FACTOR: Record<ArenaDivision, number> = {
  BRONZE:   32,
  SILVER:   28,
  GOLD:     24,
  PLATINUM: 20,
  DIAMOND:  16,
  LEGEND:   12,
};

export function divisionForElo(elo: number): ArenaDivision {
  if (elo >= DIVISION_THRESHOLDS.LEGEND)    return 'LEGEND';
  if (elo >= DIVISION_THRESHOLDS.DIAMOND)   return 'DIAMOND';
  if (elo >= DIVISION_THRESHOLDS.PLATINUM)  return 'PLATINUM';
  if (elo >= DIVISION_THRESHOLDS.GOLD)      return 'GOLD';
  if (elo >= DIVISION_THRESHOLDS.SILVER)    return 'SILVER';
  return 'BRONZE';
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloUpdateInput {
  winnerElo: number;
  loserElo: number;
  winnerDivision: ArenaDivision;
  loserDivision: ArenaDivision;
  isDraw?: boolean;
}

export interface EloUpdateResult {
  winnerNewElo: number;
  loserNewElo: number;
  winnerNewDivision: ArenaDivision;
  loserNewDivision: ArenaDivision;
  winnerDelta: number;
  loserDelta: number;
}

export function computeEloUpdate(input: EloUpdateInput): EloUpdateResult {
  const kW = K_FACTOR[input.winnerDivision];
  const kL = K_FACTOR[input.loserDivision];

  const expW = expectedScore(input.winnerElo, input.loserElo);
  const expL = 1 - expW;

  const actualW = input.isDraw ? 0.5 : 1;
  const actualL = input.isDraw ? 0.5 : 0;

  const winnerDelta = Math.round(kW * (actualW - expW));
  const loserDelta  = Math.round(kL * (actualL - expL));

  const winnerNewElo = Math.max(100, input.winnerElo + winnerDelta);
  const loserNewElo  = Math.max(100, input.loserElo + loserDelta);

  return {
    winnerNewElo,
    loserNewElo,
    winnerNewDivision: divisionForElo(winnerNewElo),
    loserNewDivision: divisionForElo(loserNewElo),
    winnerDelta,
    loserDelta,
  };
}

// Seasonal decay: inactive players lose ELO each season.
export interface DecayInput {
  currentElo: number;
  division: ArenaDivision;
  inactiveSeasons: number; // number of seasons without a battle
}

export function applyDecay(input: DecayInput): number {
  if (input.inactiveSeasons === 0) return input.currentElo;
  const decayRate = input.division === 'LEGEND' ? 0.03 : 0.05;
  const decayed = Math.round(input.currentElo * Math.pow(1 - decayRate, input.inactiveSeasons));
  return Math.max(DIVISION_THRESHOLDS.BRONZE + 100, decayed);
}

// Seasonal reset: soft reset — move ELO 25% toward 1200.
export function seasonalReset(elo: number): number {
  const target = 1200;
  return Math.round(elo + (target - elo) * 0.25);
}

export interface SeasonRankSnapshot {
  starProfileId: string;
  elo: number;
  division: ArenaDivision;
  wins: number;
  losses: number;
  rank: number;
}

export function rankLeaderboard(entries: Array<{ starProfileId: string; elo: number; wins: number; losses: number }>): SeasonRankSnapshot[] {
  return entries
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins)
    .map((e, i) => ({
      ...e,
      division: divisionForElo(e.elo),
      rank: i + 1,
    }));
}
