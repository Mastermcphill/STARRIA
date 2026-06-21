import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NestModerationService } from '../moderation/moderation.service';

describe('AdminService', () => {
  let svc: AdminService;
  let db: any;
  let moderation: any;
  let revocation: any;

  beforeEach(() => {
    db = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      battle: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), findUnique: jest.fn() },
      wallet: { findUnique: jest.fn() },
      walletEntry: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
      replay: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
      moderationAuditLog: { create: jest.fn() },
    };
    moderation = { listReports: jest.fn(async () => []) };
    revocation = { revokeAllForUser: jest.fn(async () => undefined) };
    svc = new AdminService(db as PrismaService, moderation as NestModerationService, revocation);
  });

  it('looks up a user by id/email/username', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    const u = await svc.lookupUser('a@b.c');
    expect(u.id).toBe('u1');
    expect(db.user.findFirst).toHaveBeenCalled();
  });

  it('rejects an empty lookup query', async () => {
    await expect(svc.lookupUser('  ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the looked-up user does not exist', async () => {
    db.user.findFirst.mockResolvedValue(null);
    await expect(svc.lookupUser('ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suspends a user and writes an audit log', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1' });
    db.user.update.mockResolvedValue({ id: 'u1', isSuspended: true });
    const res = await svc.suspendUser('admin-1', 'u1', 'abuse');
    expect(res.isSuspended).toBe(true);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isSuspended: true }) }),
    );
    expect(db.moderationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'suspend' }) }),
    );
    // Suspension must invalidate the user's active tokens.
    expect(revocation.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refuses to suspend an unknown user', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(svc.suspendUser('admin-1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unsuspends a user', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1' });
    db.user.update.mockResolvedValue({ id: 'u1', isSuspended: false });
    const res = await svc.unsuspendUser('admin-1', 'u1');
    expect(res.isSuspended).toBe(false);
    expect(db.moderationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'unsuspend' }) }),
    );
  });

  it('audits transactions for a specific user via their wallet', async () => {
    db.wallet.findUnique.mockResolvedValue({ id: 'w1' });
    await svc.auditTransactions('u1');
    expect(db.walletEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { walletId: 'w1' } }),
    );
  });

  it('throws when auditing transactions for a user with no wallet', async () => {
    db.wallet.findUnique.mockResolvedValue(null);
    await expect(svc.auditTransactions('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
