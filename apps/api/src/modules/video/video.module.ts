import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { PrismaVideoStore } from './prisma-video.store';
import { TranscoderStub } from './processing/transcoder.stub';
import { ThumbnailGeneratorStub } from './processing/thumbnail.stub';
import { MetadataExtractorStub } from './processing/metadata.stub';
import { VideoSearchIndexAdapter } from './video-search-index.adapter';

@Module({
  controllers: [VideoController],
  providers: [
    VideoService,
    PrismaVideoStore,
    TranscoderStub,
    ThumbnailGeneratorStub,
    MetadataExtractorStub,
    VideoSearchIndexAdapter,
  ],
  exports: [VideoService, PrismaVideoStore],
})
export class VideoModule {}
