import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VideoService as CoreVideoService } from '@starria/video-core';
import type { VideoRecord, VideoGenre } from '@starria/video-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaVideoStore } from './prisma-video.store';
import { TranscoderStub } from './processing/transcoder.stub';
import { ThumbnailGeneratorStub } from './processing/thumbnail.stub';
import { MetadataExtractorStub } from './processing/metadata.stub';
import { VideoSearchIndexAdapter } from './video-search-index.adapter';
import type { UploadVideoDto } from './dto/upload-video.dto';

@Injectable()
export class VideoService {
  private readonly core: CoreVideoService;

  constructor(
    private readonly db: PrismaService,
    store: PrismaVideoStore,
    transcoder: TranscoderStub,
    thumbnails: ThumbnailGeneratorStub,
    metadata: MetadataExtractorStub,
    searchIndex: VideoSearchIndexAdapter,
    @Inject(EVENT_BUS) eventBus: EventBus,
  ) {
    this.core = new CoreVideoService(store, transcoder, thumbnails, metadata, searchIndex, eventBus);
  }

  /** Resolve the caller's star profile (creators only). */
  private async requireStarProfile(userId: string): Promise<string> {
    const star = await this.db.starProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!star) throw new ForbiddenException('Only creators (stars) can upload videos');
    return star.id;
  }

  /**
   * Upload → register the video, then run the processing pipeline and publish.
   * In production, processAndPublish would run async in a worker keyed off
   * VideoUploadedEvent; for the MVP we run it inline so the flow is observable.
   */
  async upload(userId: string, dto: UploadVideoDto): Promise<VideoRecord> {
    const starProfileId = await this.requireStarProfile(userId);

    const created = await this.core.registerUpload({
      starProfileId,
      uploaderUserId: userId,
      title: dto.title,
      description: dto.description,
      genre: dto.genre as VideoGenre,
      country: dto.country,
      language: dto.language,
      tags: dto.tags,
      storageKey: dto.storageKey,
    });

    return this.core.processAndPublish(created.id);
  }

  async getById(videoId: string): Promise<VideoRecord> {
    const video = await this.core.getById(videoId);
    if (!video) throw new NotFoundException('Video not found');
    return video;
  }

  /** Register + process without publishing (e.g. for review queues). */
  async registerOnly(userId: string, dto: UploadVideoDto): Promise<VideoRecord> {
    const starProfileId = await this.requireStarProfile(userId);
    return this.core.registerUpload({
      starProfileId,
      uploaderUserId: userId,
      title: dto.title,
      description: dto.description,
      genre: dto.genre as VideoGenre,
      country: dto.country,
      language: dto.language,
      tags: dto.tags,
      storageKey: dto.storageKey,
    });
  }

  processAndPublish(videoId: string): Promise<VideoRecord> {
    return this.core.processAndPublish(videoId);
  }
}
