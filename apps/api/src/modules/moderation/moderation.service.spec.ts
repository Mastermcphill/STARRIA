import { NotFoundException } from '@nestjs/common';
import { NestModerationService } from './moderation.service';
import { PrismaModerationStore } from './prisma-moderation.store';
import { PrismaService } from '../../prisma/prisma.service';

describe('NestModerationService', () => {
  let svc: NestModerationService;
  let store: jest.Mocked<PrismaModerationStore>;
  let db: any;

  beforeEach(() => {
    store = {
      saveReport: jest.fn(async (r) => r),
      findReport: jest.fn(),
      listQueue: jest.fn(async () => []),
      updateQueueStatus: jest.fn(async (id, status) => ({ id, status } as any)),
      saveBlock: jest.fn(async (r) => r),
      removeBlock: jest.fn(),
      findBlock: jest.fn(),
      listBlocked: jest.fn(),
    } as any;

    db = {
      moderationReport: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
      moderationAuditLog: { create: jest.fn() },
    };

    const safety = {
      assess: jest.fn(async () => ({
        allowed: true,
        signals: [],
        requiresHumanReview: false,
        requiresEscalation: false,
      })),
    } as any;
    svc = new NestModerationService(store, db as PrismaService, safety);
  });

  it('persists a report via the store', async () => {
    const rec = await svc.report('reporter-1', {
      targetId: 'u-2',
      targetType: 'user',
      reason: 'harassment',
    });
    expect(store.saveReport).toHaveBeenCalledTimes(1);
    expect(rec.reporterId).toBe('reporter-1');
    expect(rec.status).toBe('open');
  });

  it('blocks a user and writes an audit log', async () => {
    store.findBlock.mockResolvedValue(undefined);
    await svc.block('blocker-1', 'blocked-2', 'spam');
    expect(store.saveBlock).toHaveBeenCalledTimes(1);
    expect(db.moderationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'block' }) }),
    );
  });

  it('unblocks and audits', async () => {
    const res = await svc.unblock('blocker-1', 'blocked-2');
    expect(res.unblocked).toBe(true);
    expect(store.removeBlock).toHaveBeenCalledWith('blocker-1', 'blocked-2');
    expect(db.moderationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'unblock' }) }),
    );
  });

  it('takedown resolves open reports and audits the count', async () => {
    db.moderationReport.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    const res = await svc.takedown('admin-1', 'event', 'e-9', 'tos violation');
    expect(res.reportsResolved).toBe(2);
    expect(store.updateQueueStatus).toHaveBeenCalledTimes(2);
    expect(store.updateQueueStatus).toHaveBeenCalledWith('r1', 'resolved', { assignedTo: 'admin-1' });
    expect(db.moderationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'takedown' }) }),
    );
  });

  it('rejects resolve on a missing case', async () => {
    db.moderationReport.findUnique.mockResolvedValue(null);
    await expect(svc.resolveReport('mod-1', 'nope', 'approved')).rejects.toBeInstanceOf(NotFoundException);
  });
});
