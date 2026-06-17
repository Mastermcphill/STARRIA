import { computePatronLevel, PATRON_TIERS } from './patron-level';

describe('Patron Level Computation', () => {
  it('returns supporter for 0 coins', () => {
    expect(computePatronLevel(0)).toBe('supporter');
  });

  it('returns patron at 500 coins', () => {
    expect(computePatronLevel(500)).toBe('patron');
  });

  it('returns champion at 2000 coins', () => {
    expect(computePatronLevel(2000)).toBe('champion');
  });

  it('returns benefactor at 10000 coins', () => {
    expect(computePatronLevel(10000)).toBe('benefactor');
  });

  it('returns legendary_patron at 50000 coins', () => {
    expect(computePatronLevel(50000)).toBe('legendary_patron');
  });

  it('stays at lower tier when just below threshold', () => {
    expect(computePatronLevel(499)).toBe('supporter');
    expect(computePatronLevel(1999)).toBe('patron');
    expect(computePatronLevel(9999)).toBe('champion');
  });

  it('PATRON_TIERS has 5 entries in ascending order', () => {
    expect(PATRON_TIERS).toHaveLength(5);
    for (let i = 1; i < PATRON_TIERS.length; i++) {
      expect(PATRON_TIERS[i].coinsThreshold).toBeGreaterThan(PATRON_TIERS[i - 1].coinsThreshold);
    }
  });
});
