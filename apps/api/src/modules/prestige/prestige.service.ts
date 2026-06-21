import { Injectable, Inject } from '@nestjs/common';
import {
  WhiteStarService,
  GoldStarService,
  UploadAllowanceService,
  CreatorFeeService,
  type CalculateWhiteStarInput,
} from '@starria/star-core';
import type { GoldStarCalculateInput } from '@starria/star-core';
import {
  PrismaWhiteStarRepository,
  PrismaGoldStarRepository,
  PrismaLeaderboardRepository,
} from './prisma-prestige.repository';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';

@Injectable()
export class PrestigeService {
  readonly whiteStarService: WhiteStarService;
  readonly goldStarService: GoldStarService;
  readonly uploadService: UploadAllowanceService;
  readonly feeService: CreatorFeeService;
  readonly leaderboardRepo: PrismaLeaderboardRepository;

  constructor(
    private readonly wsRepo: PrismaWhiteStarRepository,
    private readonly gsRepo: PrismaGoldStarRepository,
    readonly lbRepo: PrismaLeaderboardRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.whiteStarService  = new WhiteStarService(wsRepo, eventBus);
    this.goldStarService   = new GoldStarService(gsRepo, eventBus);
    this.uploadService     = new UploadAllowanceService(wsRepo, eventBus);
    this.feeService        = new CreatorFeeService(wsRepo, gsRepo);
    this.leaderboardRepo   = lbRepo;
  }

  // ── White Star ────────────────────────────────────────────────────────────

  async recalculateWhiteStar(starId: string, input: CalculateWhiteStarInput) {
    return this.whiteStarService.recalculate(starId, input);
  }

  async getWhiteStar(starId: string) {
    return this.whiteStarService.getProfile(starId);
  }

  async getWhiteStarHistory(starId: string, limit = 30) {
    return this.whiteStarService.getHistory(starId, limit);
  }

  async applyDecay(starId: string) {
    return this.whiteStarService.applyDecay(starId);
  }

  // ── Gold Star ─────────────────────────────────────────────────────────────

  async recalculateGoldStar(starId: string, input: GoldStarCalculateInput) {
    return this.goldStarService.recalculate(starId, input);
  }

  async getGoldStar(starId: string) {
    return this.goldStarService.getProfile(starId);
  }

  async getAchievements(starId: string) {
    return this.goldStarService.getAchievements(starId);
  }

  async unlockAchievement(
    starId: string,
    type: Parameters<GoldStarService['unlockAchievement']>[1],
    title: string,
    description: string,
  ) {
    return this.goldStarService.unlockAchievement(starId, type, title, description);
  }

  // ── Combined prestige view ────────────────────────────────────────────────

  async getPrestigeSummary(starId: string) {
    const [whiteStar, goldStar, fee, achievements] = await Promise.all([
      this.getWhiteStar(starId),
      this.getGoldStar(starId),
      this.feeService.resolve(starId),
      this.getAchievements(starId),
    ]);
    return { whiteStar, goldStar, fee, achievements };
  }

  // ── Upload allowance ──────────────────────────────────────────────────────

  async checkUpload(starId: string) {
    return this.uploadService.getStatus(starId);
  }

  async consumeUpload(starId: string) {
    return this.uploadService.checkAndConsume(starId);
  }

  // ── Creator fee ───────────────────────────────────────────────────────────

  async resolveFee(starId: string) {
    return this.feeService.resolve(starId);
  }
}
