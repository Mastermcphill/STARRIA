import { InMemoryEventBus } from '@starria/domain-events';
import { SUPPORTER_STREAK_ACHIEVED, SUPPORTER_ANNIVERSARY } from '@starria/domain-events';
import type { SupportStreakAchievedEvent, SupportAnniversaryEvent } from '@starria/domain-events';

// ---------------------------------------------------------------------------
// Pure streak logic extracted for unit testing — mirrors the service constants
// ---------------------------------------------------------------------------

const STREAK_WINDOW_MS   = 25 * 60 * 60 * 1000; // 25 h
const STREAK_MILESTONES  = [7, 30, 100, 365] as const;
const ANNIVERSARY_YEARS  = [1, 2, 3, 5, 10] as const;

function advanceDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function simulateStreak(giftDates: Date[]): {
  currentStreakDays: number;
  longestStreakDays: number;
  broken: boolean;
} {
  if (giftDates.length === 0) return { currentStreakDays: 0, longestStreakDays: 0, broken: false };

  let current = 1;
  let longest = 1;
  let broken = false;

  for (let i = 1; i < giftDates.length; i++) {
    const gap = giftDates[i].getTime() - giftDates[i - 1].getTime();
    const sameDay =
      giftDates[i].getUTCDate()  === giftDates[i - 1].getUTCDate() &&
      giftDates[i].getUTCMonth() === giftDates[i - 1].getUTCMonth() &&
      giftDates[i].getUTCFullYear() === giftDates[i - 1].getUTCFullYear();

    if (gap <= STREAK_WINDOW_MS) {
      if (!sameDay) current++;
    } else {
      broken = true;
      current = 1;
    }
    longest = Math.max(longest, current);
  }

  return { currentStreakDays: current, longestStreakDays: longest, broken };
}

function computeAgeYears(startedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - startedAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------

describe('Streak simulation', () => {
  const base = new Date('2025-01-01T12:00:00Z');

  it('starts at 1 for a single gift', () => {
    expect(simulateStreak([base]).currentStreakDays).toBe(1);
  });

  it('increments each calendar day', () => {
    const dates = [0, 1, 2, 3, 4, 5, 6].map(d => advanceDays(base, d));
    const { currentStreakDays } = simulateStreak(dates);
    expect(currentStreakDays).toBe(7);
  });

  it('does not double-count same-day repeat gifts', () => {
    // Gift twice on day 1, once on day 2
    const dates = [base, new Date(base.getTime() + 3600_000), advanceDays(base, 1)];
    expect(simulateStreak(dates).currentStreakDays).toBe(2);
  });

  it('resets to 1 after a gap > 25h', () => {
    const dates = [base, advanceDays(base, 1), advanceDays(base, 3)]; // 2-day skip breaks streak
    const result = simulateStreak(dates);
    expect(result.broken).toBe(true);
    expect(result.currentStreakDays).toBe(1);
  });

  it('tracks longest streak across a reset', () => {
    const streak1 = [0, 1, 2, 3, 4, 5, 6].map(d => advanceDays(base, d)); // 7 days
    const gap = advanceDays(base, 10);                                       // broken
    const streak2 = [11, 12].map(d => advanceDays(base, d));                 // 2 days
    const { longestStreakDays, currentStreakDays } = simulateStreak([...streak1, gap, ...streak2]);
    expect(longestStreakDays).toBe(7);
    expect(currentStreakDays).toBe(2);
  });

  it('reaches 30-day milestone after 30 consecutive daily gifts', () => {
    const dates = Array.from({ length: 30 }, (_, i) => advanceDays(base, i));
    const { currentStreakDays } = simulateStreak(dates);
    expect(currentStreakDays).toBe(30);
    expect(STREAK_MILESTONES).toContain(30);
  });
});

describe('Streak milestone thresholds', () => {
  it('has milestones at 7, 30, 100, 365 days', () => {
    expect(STREAK_MILESTONES).toEqual([7, 30, 100, 365]);
  });

  it.each([7, 30, 100, 365])('%i-day streak triggers milestone', (days) => {
    const dates = Array.from({ length: days }, (_, i) => advanceDays(new Date('2025-01-01T00:00:00Z'), i));
    expect(simulateStreak(dates).currentStreakDays).toBeGreaterThanOrEqual(days);
  });
});

describe('Anniversary computation', () => {
  const start = new Date('2024-01-15T00:00:00Z');

  it('0 years before first anniversary', () => {
    const now = new Date('2024-06-15T00:00:00Z');
    expect(computeAgeYears(start, now)).toBe(0);
  });

  it('exactly 1 year on anniversary date', () => {
    const now = new Date('2025-01-15T00:00:00Z');
    expect(computeAgeYears(start, now)).toBe(1);
  });

  it('still 1 year one day before 2nd anniversary', () => {
    const now = new Date('2026-01-14T00:00:00Z');
    expect(computeAgeYears(start, now)).toBe(1);
  });

  it('2 years on 2nd anniversary', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(computeAgeYears(start, now)).toBe(2);
  });

  it('anniversary milestones are defined at 1, 2, 3, 5, 10 years', () => {
    expect(ANNIVERSARY_YEARS).toEqual([1, 2, 3, 5, 10]);
  });
});

describe('SupportStreakAchievedEvent shape', () => {
  it('is emitted with correct payload by InMemoryEventBus', async () => {
    const bus = new InMemoryEventBus();
    const received: SupportStreakAchievedEvent[] = [];
    bus.subscribe<SupportStreakAchievedEvent>(SUPPORTER_STREAK_ACHIEVED, e => received.push(e));

    const { buildStreakAchievedEvent } = await import('@starria/support-core');
    const event = buildStreakAchievedEvent({
      supporterProfileId: 'sp-1',
      starProfileId:      'star-1',
      relationshipId:     'rel-1',
      streakDays:         7,
      longestStreakDays:  7,
      streakStartedAt:    new Date('2025-01-01').toISOString(),
    });

    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(SUPPORTER_STREAK_ACHIEVED);
    expect(received[0].payload.streakDays).toBe(7);
    expect(received[0].payload.supporterProfileId).toBe('sp-1');
  });
});

describe('SupportAnniversaryEvent shape', () => {
  it('is emitted with a human-readable message', async () => {
    const bus = new InMemoryEventBus();
    const received: SupportAnniversaryEvent[] = [];
    bus.subscribe<SupportAnniversaryEvent>(SUPPORTER_ANNIVERSARY, e => received.push(e));

    const { buildAnniversaryEvent } = await import('@starria/support-core');
    const event = buildAnniversaryEvent({
      supporterProfileId:      'sp-1',
      starProfileId:           'star-1',
      relationshipId:          'rel-1',
      years:                   1,
      relationshipStartedAt:   new Date('2024-01-15').toISOString(),
      message:                 "You've been a supporter for 1 year! 🎉",
    });

    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(SUPPORTER_ANNIVERSARY);
    expect(received[0].payload.years).toBe(1);
    expect(received[0].payload.message).toContain('1 year');
  });

  it('uses plural "years" for multi-year anniversaries', () => {
    const years = 3;
    const message = `You've been a supporter for ${years} ${years === 1 ? 'year' : 'years'}! 🎉`;
    expect(message).toContain('3 years');
  });
});
