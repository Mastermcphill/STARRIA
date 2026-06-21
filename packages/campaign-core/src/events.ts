// ---------------------------------------------------------------------------
// campaign-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  CampaignCreatedEvent,
  CampaignActivatedEvent,
  CampaignExpiredEvent,
  CampaignCancelledEvent,
} from '@starria/domain-events';
import {
  CAMPAIGN_CREATED,
  CAMPAIGN_ACTIVATED,
  CAMPAIGN_EXPIRED,
  CAMPAIGN_CANCELLED,
} from '@starria/domain-events';
import type { CampaignScope, PromotableType } from './types';

export function buildCampaignCreatedEvent(params: {
  campaignId: string;
  starId: string;
  promotableType: PromotableType;
  promotableId: string;
  scope: CampaignScope;
  coinsSpent: number;
  startsAt: string;
  expiresAt: string;
}): CampaignCreatedEvent {
  return createEvent({
    id: randomUUID(),
    type: CAMPAIGN_CREATED,
    aggregateId: params.campaignId,
    aggregateType: 'VisibilityCampaign',
    payload: params,
  });
}

export function buildCampaignActivatedEvent(params: {
  campaignId: string;
  starId: string;
  promotableType: PromotableType;
  scope: CampaignScope;
  activatedAt: string;
}): CampaignActivatedEvent {
  return createEvent({
    id: randomUUID(),
    type: CAMPAIGN_ACTIVATED,
    aggregateId: params.campaignId,
    aggregateType: 'VisibilityCampaign',
    payload: params,
  });
}

export function buildCampaignExpiredEvent(params: {
  campaignId: string;
  starId: string;
  impressions: number;
  clicks: number;
  expiredAt: string;
}): CampaignExpiredEvent {
  return createEvent({
    id: randomUUID(),
    type: CAMPAIGN_EXPIRED,
    aggregateId: params.campaignId,
    aggregateType: 'VisibilityCampaign',
    payload: params,
  });
}

export function buildCampaignCancelledEvent(params: {
  campaignId: string;
  starId: string;
  coinsRefunded: number;
  cancelledAt: string;
}): CampaignCancelledEvent {
  return createEvent({
    id: randomUUID(),
    type: CAMPAIGN_CANCELLED,
    aggregateId: params.campaignId,
    aggregateType: 'VisibilityCampaign',
    payload: params,
  });
}
