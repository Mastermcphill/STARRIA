import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { NestModerationService } from './moderation.service';
import { PrismaModerationStore } from './prisma-moderation.store';
import { ContentSafetyService } from './content-safety/content-safety.service';
import { ManualSafetyProvider } from './content-safety/manual-safety.provider';
import { CloudProviderAdapter } from './content-safety/cloud-provider.adapter';
import { ModerationSafetyAdapter } from './content-safety/moderation-safety.adapter';
import {
  CONTENT_SAFETY_PROVIDER,
  ContentSafetyProvider,
} from './content-safety/content-safety.port';

@Module({
  controllers: [ModerationController],
  providers: [
    NestModerationService,
    PrismaModerationStore,
    ManualSafetyProvider,
    ContentSafetyService,
    ModerationSafetyAdapter,
    {
      // Manual provider by default; the cloud adapter is selected only when
      // CONTENT_SAFETY_PROVIDER=cloud AND credentials are configured. Otherwise
      // we fall back to the rule-based manual provider — never a no-op.
      provide: CONTENT_SAFETY_PROVIDER,
      useFactory: (manual: ManualSafetyProvider): ContentSafetyProvider => {
        const cloud = CloudProviderAdapter.fromEnv();
        if (process.env.CONTENT_SAFETY_PROVIDER === 'cloud' && cloud) {
          return new CloudProviderAdapter(cloud);
        }
        return manual;
      },
      inject: [ManualSafetyProvider],
    },
  ],
  exports: [NestModerationService, ContentSafetyService],
})
export class ModerationModule {}
