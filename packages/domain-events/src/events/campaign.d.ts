import type { DomainEvent } from '../event';
export declare const CAMPAIGN_CREATED = "campaign.created";
export declare const CAMPAIGN_ACTIVATED = "campaign.activated";
export declare const CAMPAIGN_EXPIRED = "campaign.expired";
export declare const CAMPAIGN_CANCELLED = "campaign.cancelled";
export type CampaignScope = 'LOCAL' | 'COUNTRY' | 'GLOBAL';
export type PromotableType = 'VIDEO' | 'CREATOR' | 'LIVE_SESSION' | 'EVENT' | 'ARENA';
export interface CampaignCreatedPayload {
    readonly campaignId: string;
    readonly starId: string;
    readonly promotableType: PromotableType;
    readonly promotableId: string;
    readonly scope: CampaignScope;
    readonly coinsSpent: number;
    readonly startsAt: string;
    readonly expiresAt: string;
}
export interface CampaignActivatedPayload {
    readonly campaignId: string;
    readonly starId: string;
    readonly promotableType: PromotableType;
    readonly scope: CampaignScope;
    readonly activatedAt: string;
}
export interface CampaignExpiredPayload {
    readonly campaignId: string;
    readonly starId: string;
    readonly impressions: number;
    readonly clicks: number;
    readonly expiredAt: string;
}
export interface CampaignCancelledPayload {
    readonly campaignId: string;
    readonly starId: string;
    readonly coinsRefunded: number;
    readonly cancelledAt: string;
}
export type CampaignCreatedEvent = DomainEvent<CampaignCreatedPayload>;
export type CampaignActivatedEvent = DomainEvent<CampaignActivatedPayload>;
export type CampaignExpiredEvent = DomainEvent<CampaignExpiredPayload>;
export type CampaignCancelledEvent = DomainEvent<CampaignCancelledPayload>;
