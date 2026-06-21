import { Test } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { InMemoryEventBus } from '@starria/domain-events';

const mockPrisma: any = {
  wallet: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  walletEntry: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

describe('WalletService', () => {
  let service: WalletService;
  const bus = new InMemoryEventBus();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: bus },
      ],
    }).compile();
    service = module.get(WalletService);
  });

  describe('createWallet', () => {
    it('creates a new wallet if none exists', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.wallet.create.mockResolvedValue({ id: 'w1', userId: 'u1', coinBalance: 0, createdAt: new Date(), updatedAt: new Date() });

      const result = await service.createWallet('u1');

      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({ data: { userId: 'u1', coinBalance: 0 } });
      expect(result.coinBalance).toBe(0);
    });

    it('returns existing wallet without creating a duplicate', async () => {
      const existing = { id: 'w1', userId: 'u1', coinBalance: 50, createdAt: new Date(), updatedAt: new Date() };
      mockPrisma.wallet.findUnique.mockResolvedValue(existing);

      const result = await service.createWallet('u1');

      expect(mockPrisma.wallet.create).not.toHaveBeenCalled();
      expect(result.coinBalance).toBe(50);
    });
  });

  describe('getBalance', () => {
    it('returns balance snapshot', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ id: 'w1', userId: 'u1', coinBalance: 200, updatedAt: new Date() });

      const result = await service.getBalance('u1');

      expect(result.coinBalance).toBe(200);
      expect(result.userId).toBe('u1');
    });

    it('throws NotFoundException when wallet missing', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.getBalance('ghost')).rejects.toThrow('Wallet not found');
    });
  });

  describe('ledger integrity', () => {
    it('returns true for empty chain', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ id: 'w1', userId: 'u1', coinBalance: 0 });
      mockPrisma.walletEntry.findMany.mockResolvedValue([]);

      const valid = await service.verifyLedgerIntegrity('u1');
      expect(valid).toBe(true);
    });
  });
});
