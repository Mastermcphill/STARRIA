// Implements VideoStorePort (video-core) against Prisma.

import { Injectable, NotFoundException } from '@nestjs/common';
import type { VideoStorePort, VideoRecord, CreateVideoInput, VideoStatus, VideoGenre } from '@starria/video-core';
import type { Genre, VideoStatus as PrismaVideoStatus, Video } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaVideoStore implements VideoStorePort {
  constructor(private readonly db: PrismaService) {}

  async create(input: CreateVideoInput): Promise<VideoRecord> {
    const row = await this.db.video.create({
      data: {
        starProfileId: input.starProfileId,
        uploaderUserId: input.uploaderUserId,
        title: input.title,
        description: input.description,
        genre: input.genre as Genre,
        country: input.country,
        language: input.language,
        tags: input.tags ?? [],
        storageKey: input.storageKey,
        status: 'UPLOADING',
      },
    });
    return this.toRecord(row);
  }

  async findById(videoId: string): Promise<VideoRecord | undefined> {
    const row = await this.db.video.findUnique({ where: { id: videoId } });
    return row ? this.toRecord(row) : undefined;
  }

  async updateStatus(videoId: string, status: VideoStatus): Promise<VideoRecord> {
    const row = await this.db.video.update({
      where: { id: videoId },
      data: { status: status as PrismaVideoStatus },
    });
    return this.toRecord(row);
  }

  async applyProcessing(videoId: string, patch: {
    playbackUrl: string;
    thumbnailUrl: string;
    durationSeconds: number;
    width?: number;
    height?: number;
    language?: string;
    tags?: string[];
  }): Promise<VideoRecord> {
    const row = await this.db.video.update({
      where: { id: videoId },
      data: {
        playbackUrl: patch.playbackUrl,
        thumbnailUrl: patch.thumbnailUrl,
        durationSeconds: patch.durationSeconds,
        width: patch.width,
        height: patch.height,
        ...(patch.language ? { language: patch.language } : {}),
        ...(patch.tags && patch.tags.length ? { tags: patch.tags } : {}),
      },
    });
    return this.toRecord(row);
  }

  async markPublished(videoId: string, publishedAt: string): Promise<VideoRecord> {
    const existing = await this.db.video.findUnique({ where: { id: videoId } });
    if (!existing) throw new NotFoundException(`Video ${videoId} not found`);
    const row = await this.db.video.update({
      where: { id: videoId },
      data: { status: 'PUBLISHED', publishedAt: new Date(publishedAt) },
    });
    return this.toRecord(row);
  }

  private toRecord(v: Video): VideoRecord {
    return {
      id: v.id,
      starProfileId: v.starProfileId,
      uploaderUserId: v.uploaderUserId,
      title: v.title,
      description: v.description ?? undefined,
      genre: v.genre as VideoGenre,
      country: v.country ?? undefined,
      language: v.language ?? undefined,
      tags: v.tags,
      status: v.status as VideoStatus,
      storageKey: v.storageKey,
      playbackUrl: v.playbackUrl ?? undefined,
      thumbnailUrl: v.thumbnailUrl ?? undefined,
      durationSeconds: v.durationSeconds ?? undefined,
      width: v.width ?? undefined,
      height: v.height ?? undefined,
      viewCount: v.viewCount,
      tapCount: v.tapCount,
      createdAt: v.createdAt.toISOString(),
      publishedAt: v.publishedAt?.toISOString(),
    };
  }
}
