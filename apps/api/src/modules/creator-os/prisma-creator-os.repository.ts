// ---------------------------------------------------------------------------
// creator-os — Prisma adapters for CalendarStorePort, CommerceStorePort and
// ClipStorePort (Sprint 10). Replaces the in-memory Maps with the
// CreatorCalendarEntry / CreatorCommerceItem / CreatorCommercePurchase /
// CreatorClip tables. The coin ledger, poster/clip generators and analytics
// source remain unchanged (wallet adapter / external generator stubs).
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CalendarStorePort,
  CommerceStorePort,
  ClipStorePort,
  CalendarEntry,
  CommerceItem,
  Clip,
  CalendarEntryStatus,
  CommerceItemType,
  ClipLength,
} from '@starria/creator-os-core';
import type {
  CreatorCalendarEntry as DbCalendar,
  CreatorCommerceItem as DbCommerce,
  CreatorClip as DbClip,
} from '@prisma/client';

function toCalendar(e: DbCalendar): CalendarEntry {
  return {
    id: e.id,
    creatorId: e.creatorId,
    title: e.title,
    kind: e.kind,
    scheduledFor: e.scheduledFor.toISOString(),
    status: e.status as CalendarEntryStatus,
    metadata: (e.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

function toCommerce(i: DbCommerce): CommerceItem {
  return {
    id: i.id,
    creatorId: i.creatorId,
    roomId: i.roomId ?? undefined,
    itemType: i.itemType as CommerceItemType,
    title: i.title,
    priceCoins: i.priceCoins,
    inventory: i.inventory ?? undefined,
    sold: i.sold,
    active: i.active,
    listedAt: i.listedAt.toISOString(),
  };
}

function toClip(c: DbClip): Clip {
  return {
    id: c.id,
    sourceReplayId: c.sourceReplayId,
    creatorId: c.creatorId,
    lengthSeconds: c.lengthSeconds as ClipLength,
    startOffsetSeconds: c.startOffsetSeconds,
    clipUrl: c.clipUrl,
    generatedAt: c.generatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaCalendarStore implements CalendarStorePort {
  constructor(private readonly db: PrismaService) {}

  async create(entry: CalendarEntry): Promise<CalendarEntry> {
    const e = await this.db.creatorCalendarEntry.create({
      data: {
        id: entry.id,
        creatorId: entry.creatorId,
        title: entry.title,
        kind: entry.kind,
        scheduledFor: new Date(entry.scheduledFor),
        status: entry.status,
        metadata: (entry.metadata as object | undefined) ?? undefined,
      },
    });
    return toCalendar(e);
  }

  async list(creatorId: string): Promise<CalendarEntry[]> {
    const rows = await this.db.creatorCalendarEntry.findMany({ where: { creatorId } });
    return rows.map(toCalendar);
  }

  async update(id: string, patch: Partial<CalendarEntry>): Promise<CalendarEntry> {
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.kind !== undefined) data.kind = patch.kind;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.scheduledFor !== undefined) data.scheduledFor = new Date(patch.scheduledFor);
    if (patch.metadata !== undefined) data.metadata = (patch.metadata as object | undefined) ?? undefined;
    const e = await this.db.creatorCalendarEntry.update({ where: { id }, data });
    return toCalendar(e);
  }
}

@Injectable()
export class PrismaCommerceStore implements CommerceStorePort {
  constructor(private readonly db: PrismaService) {}

  async create(item: CommerceItem): Promise<CommerceItem> {
    const i = await this.db.creatorCommerceItem.create({
      data: {
        id: item.id,
        creatorId: item.creatorId,
        roomId: item.roomId ?? null,
        itemType: item.itemType,
        title: item.title,
        priceCoins: item.priceCoins,
        inventory: item.inventory ?? null,
        sold: item.sold,
        active: item.active,
        listedAt: new Date(item.listedAt),
      },
    });
    return toCommerce(i);
  }

  async get(id: string): Promise<CommerceItem | null> {
    const i = await this.db.creatorCommerceItem.findUnique({ where: { id } });
    return i ? toCommerce(i) : null;
  }

  async update(id: string, patch: Partial<CommerceItem>): Promise<CommerceItem> {
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.priceCoins !== undefined) data.priceCoins = patch.priceCoins;
    if (patch.sold !== undefined) data.sold = patch.sold;
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.inventory !== undefined) data.inventory = patch.inventory ?? null;
    if (patch.roomId !== undefined) data.roomId = patch.roomId ?? null;
    const i = await this.db.creatorCommerceItem.update({ where: { id }, data });
    return toCommerce(i);
  }

  async listByRoom(roomId: string): Promise<CommerceItem[]> {
    const rows = await this.db.creatorCommerceItem.findMany({ where: { roomId } });
    return rows.map(toCommerce);
  }

  async findPurchaseByKey(key: string): Promise<{ itemId: string; buyerId: string } | null> {
    const p = await this.db.creatorCommercePurchase.findUnique({ where: { idempotencyKey: key } });
    return p ? { itemId: p.itemId, buyerId: p.buyerId } : null;
  }

  async recordPurchase(key: string, itemId: string, buyerId: string): Promise<void> {
    await this.db.creatorCommercePurchase.create({
      data: { idempotencyKey: key, itemId, buyerId },
    });
  }
}

@Injectable()
export class PrismaClipStore implements ClipStorePort {
  constructor(private readonly db: PrismaService) {}

  async create(clip: Clip): Promise<Clip> {
    const c = await this.db.creatorClip.create({
      data: {
        id: clip.id,
        sourceReplayId: clip.sourceReplayId,
        creatorId: clip.creatorId,
        lengthSeconds: clip.lengthSeconds,
        startOffsetSeconds: clip.startOffsetSeconds,
        clipUrl: clip.clipUrl,
        generatedAt: new Date(clip.generatedAt),
      },
    });
    return toClip(c);
  }

  async listByReplay(replayId: string): Promise<Clip[]> {
    const rows = await this.db.creatorClip.findMany({ where: { sourceReplayId: replayId } });
    return rows.map(toClip);
  }
}
