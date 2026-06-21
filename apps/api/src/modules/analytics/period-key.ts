// ---------------------------------------------------------------------------
// Pure period-bucket helpers for analytics rollups. No Date.now() — every
// function derives the bucket from an explicit timestamp so rollups are
// deterministic and testable.
// ---------------------------------------------------------------------------

export type RollupPeriod = 'DAY' | 'WEEK' | 'MONTH';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO-8601 week number ('YYYY-Www') for a date (UTC). */
function isoWeekKey(d: Date): string {
  // Copy date, set to nearest Thursday (ISO weeks are Mon–Sun, week 1 has Jan 4).
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Bucket key for an ISO timestamp under the given period. */
export function periodKeyFor(period: RollupPeriod, iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  switch (period) {
    case 'DAY':
      return `${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    case 'WEEK':
      return isoWeekKey(d);
    case 'MONTH':
      return `${y}-${pad(d.getUTCMonth() + 1)}`;
  }
}
