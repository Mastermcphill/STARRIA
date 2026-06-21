import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import { POSTER_GENERATED, POSTER_FAILED, createEvent } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTicketRepository } from '../ticketing/prisma-ticket-store.repository';
import type { GeneratePosterDto } from './dto/generate-poster.dto';

const POSTER_COIN_COST = 50;

@Injectable()
export class PosterService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: PrismaTicketRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async generatePoster(starUserId: string, dto: GeneratePosterDto) {
    const starProfile = await this.db.starProfile.findUnique({
      where: { userId: starUserId },
      select: { id: true },
    });
    if (!starProfile) throw new NotFoundException('Star profile not found');

    // Debit coin cost
    const key = `poster:${randomUUID()}`;
    try {
      await this.ledger.debit({
        userId: starUserId,
        amount: POSTER_COIN_COST,
        reason: 'poster_generation',
        idempotencyKey: key,
      });
    } catch {
      throw new UnprocessableEntityException(
        `Insufficient coins — poster generation costs ${POSTER_COIN_COST} coins`,
      );
    }

    const generationId = randomUUID();
    const startMs = Date.now();

    let resultImageUrl: string;
    let status: 'COMPLETED' | 'FAILED' = 'COMPLETED';

    try {
      // TODO: call real AI image generation (OpenAI DALL·E / Stability AI / Replicate)
      // For now return a deterministic placeholder URL.
      resultImageUrl = `https://placehold.co/1080x1920/1a1a2e/ffffff?text=${encodeURIComponent(dto.title)}`;
    } catch (err) {
      status = 'FAILED';
      resultImageUrl = '';

      // Refund on failure
      await this.ledger.credit({
        userId: starUserId,
        amount: POSTER_COIN_COST,
        reason: 'poster_refund',
        idempotencyKey: `${key}:refund`,
      });

      void this.eventBus.publish(createEvent({
        id: randomUUID(), type: POSTER_FAILED,
        aggregateId: generationId, aggregateType: 'PosterGeneration',
        payload: {
          generationId, starId: starProfile.id, eventId: dto.eventId,
          reason: String(err), coinsRefunded: POSTER_COIN_COST,
          failedAt: new Date().toISOString(),
        },
      }));

      throw new UnprocessableEntityException('Poster generation failed — coins refunded');
    }

    const generationMs = Date.now() - startMs;

    // Persist to PosterGeneration table
    const generation = await this.db.posterGeneration.create({
      data: {
        id: generationId,
        starProfileId: starProfile.id,
        eventId: dto.eventId ?? null,
        prompt: [dto.title, dto.eventType, dto.style ?? 'bold', dto.dateTime].filter(Boolean).join(' | '),
        style: dto.style ?? 'bold',
        resultImageUrl,
        storageKey: `posters/${generationId}`,
        status,
        generationMs,
      },
    });

    void this.eventBus.publish(createEvent({
      id: randomUUID(), type: POSTER_GENERATED,
      aggregateId: generationId, aggregateType: 'PosterGeneration',
      payload: {
        generationId, starId: starProfile.id, eventId: dto.eventId,
        resultImageUrl, prompt: generation.prompt ?? '',
        style: dto.style, coinsCharged: POSTER_COIN_COST,
        generationMs, generatedAt: new Date().toISOString(),
      },
    }));

    return {
      generationId: generation.id,
      status: generation.status,
      resultImageUrl: generation.resultImageUrl,
      thumbnailUrl: generation.resultImageUrl,
      prompt: generation.prompt,
      coinsCharged: POSTER_COIN_COST,
      generationMs,
    };
  }

  async getMyPosters(starUserId: string) {
    const starProfile = await this.db.starProfile.findUnique({
      where: { userId: starUserId },
      select: { id: true },
    });
    if (!starProfile) return { items: [], total: 0 };

    const [items, total] = await Promise.all([
      this.db.posterGeneration.findMany({
        where: { starProfileId: starProfile.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.db.posterGeneration.count({ where: { starProfileId: starProfile.id } }),
    ]);

    return { items, total };
  }
}
