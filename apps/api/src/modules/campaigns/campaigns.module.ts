import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaCampaignRepository } from './prisma-campaign.repository';
import { InMemoryCampaignLedger } from './in-memory-campaign.repository';

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, PrismaCampaignRepository, InMemoryCampaignLedger],
  exports: [CampaignsService],
})
export class CampaignsModule {}
