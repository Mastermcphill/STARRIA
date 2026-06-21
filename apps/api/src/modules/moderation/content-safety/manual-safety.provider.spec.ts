import { ManualSafetyProvider } from './manual-safety.provider';

describe('ManualSafetyProvider', () => {
  const provider = new ManualSafetyProvider();

  it('allows benign text', async () => {
    const v = await provider.scanText('hey, great stream today! loved the arena battle.');
    expect(v.decision).toBe('allow');
    expect(v.findings).toHaveLength(0);
  });

  it('blocks critical threats', async () => {
    const v = await provider.scanText('i will kill you after the stream');
    expect(v.decision).toBe('block');
    expect(v.severity).toBe('critical');
    expect(v.findings[0].category).toBe('threats');
  });

  it('routes hate speech to human review', async () => {
    const v = await provider.scanText('you are subhuman');
    expect(v.decision).toBe('review');
    expect(v.findings.some((f) => f.category === 'hate')).toBe(true);
  });

  it('flags spam for review (medium)', async () => {
    const v = await provider.scanText('click here to win free money now');
    expect(v.decision).toBe('review');
    expect(v.findings.some((f) => f.category === 'spam')).toBe(true);
  });

  it('detects link-flooding as spam', async () => {
    const text = Array.from({ length: 6 }, (_, i) => `https://x${i}.com`).join(' ');
    const v = await provider.scanText(text);
    expect(v.findings.some((f) => f.category === 'spam')).toBe(true);
  });

  it('fails closed on images — always human review', async () => {
    const v = await provider.scanImage('https://cdn.example/x.jpg');
    expect(v.decision).toBe('review');
  });

  it('is case-insensitive', async () => {
    const v = await provider.scanText('I WILL KILL YOU');
    expect(v.decision).toBe('block');
  });
});
