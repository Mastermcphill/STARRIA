import { ContentSafetyService } from './content-safety.service';
import { ManualSafetyProvider } from './manual-safety.provider';

/** Minimal stateful fake of the Prisma contentScan + audit delegates. */
function makeDb() {
  const rows = new Map<string, any>();
  const audits: any[] = [];
  let seq = 0;
  return {
    rows,
    audits,
    contentScan: {
      create: jest.fn(async ({ data }: any) => {
        const id = `scan-${++seq}`;
        const row = { id, ...data, payload: data.payload ?? null };
        rows.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = { ...rows.get(where.id), ...data };
        rows.set(where.id, row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return [...rows.values()].filter((r) =>
          where?.status?.in ? where.status.in.includes(r.status) : true,
        );
      }),
    },
    moderationAuditLog: {
      create: jest.fn(async ({ data }: any) => {
        audits.push(data);
        return data;
      }),
    },
  };
}

describe('ContentSafetyService', () => {
  let db: any;
  let moderation: any;
  let svc: ContentSafetyService;

  beforeEach(() => {
    db = makeDb();
    moderation = { takedown: jest.fn(async () => ({ reportsResolved: 0 })) };
    svc = new ContentSafetyService(new ManualSafetyProvider(), db, moderation);
  });

  it('allows benign text and persists ALLOWED', async () => {
    const row = await svc.scan({
      targetType: 'post',
      targetId: 'p1',
      kind: 'TEXT',
      text: 'lovely arena tonight',
    });
    expect(row.status).toBe('ALLOWED');
    expect(moderation.takedown).not.toHaveBeenCalled();
  });

  it('auto-blocks critical text and triggers takedown', async () => {
    const row = await svc.scan({
      targetType: 'message',
      targetId: 'm1',
      kind: 'TEXT',
      text: 'i will kill you',
    });
    expect(row.status).toBe('BLOCKED');
    expect(moderation.takedown).toHaveBeenCalledWith(
      expect.any(String),
      'message',
      'm1',
      expect.stringContaining('auto-block'),
    );
  });

  it('flags images for review and writes an audit log', async () => {
    const row = await svc.scan({
      targetType: 'profile',
      targetId: 'u1',
      kind: 'IMAGE',
      imageUrl: 'https://cdn/x.jpg',
    });
    expect(row.status).toBe('FLAGGED');
    expect(db.audits.some((a: any) => a.action === 'content_flagged')).toBe(true);
  });

  it('marks ERROR when the provider throws, never auto-allowing', async () => {
    const throwing = {
      name: 'boom',
      scanText: async () => {
        throw new Error('provider down');
      },
      scanImage: async () => {
        throw new Error('provider down');
      },
    };
    const errSvc = new ContentSafetyService(throwing as any, db, moderation);
    const row = await errSvc.scan({ targetType: 'post', targetId: 'p9', kind: 'TEXT', text: 'hi' });
    expect(row.status).toBe('ERROR');
  });

  it('processPending re-scans queued rows from their stored payload', async () => {
    await svc.enqueue({ targetType: 'post', targetId: 'p2', kind: 'TEXT', text: 'i will kill you' });
    await svc.enqueue({ targetType: 'post', targetId: 'p3', kind: 'TEXT', text: 'hello there' });
    const n = await svc.processPending();
    expect(n).toBe(2);
    const statuses = [...db.rows.values()].map((r: any) => r.status);
    expect(statuses).toContain('BLOCKED');
    expect(statuses).toContain('ALLOWED');
  });
});
