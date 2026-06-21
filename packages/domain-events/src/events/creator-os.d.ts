import type { DomainEvent } from '../event';
export declare const CREATOR_ONBOARDED = "creator.onboarded";
export declare const CREATOR_SETTINGS_UPDATED = "creator.settings.updated";
export declare const CREATOR_PAYOUT_CONFIGURED = "creator.payout.configured";
export declare const CREATOR_DEACTIVATED = "creator.deactivated";
export declare const CREATOR_REACTIVATED = "creator.reactivated";
export interface CreatorOnboardedPayload {
    readonly creatorId: string;
    readonly userId: string;
    readonly starId: string;
    readonly onboardedAt: string;
    readonly onboardingVersion: string;
}
export interface CreatorSettingsUpdatedPayload {
    readonly creatorId: string;
    readonly starId: string;
    readonly changedFields: string[];
    readonly updatedAt: string;
}
export interface CreatorPayoutConfiguredPayload {
    readonly creatorId: string;
    readonly starId: string;
    readonly payoutMethod: string;
    readonly configuredAt: string;
}
export interface CreatorDeactivatedPayload {
    readonly creatorId: string;
    readonly starId: string;
    readonly reason: string;
    readonly deactivatedAt: string;
    readonly deactivatedBy: string;
}
export interface CreatorReactivatedPayload {
    readonly creatorId: string;
    readonly starId: string;
    readonly reactivatedAt: string;
    readonly reactivatedBy: string;
}
export type CreatorOnboardedEvent = DomainEvent<CreatorOnboardedPayload>;
export type CreatorSettingsUpdatedEvent = DomainEvent<CreatorSettingsUpdatedPayload>;
export type CreatorPayoutConfiguredEvent = DomainEvent<CreatorPayoutConfiguredPayload>;
export type CreatorDeactivatedEvent = DomainEvent<CreatorDeactivatedPayload>;
export type CreatorReactivatedEvent = DomainEvent<CreatorReactivatedPayload>;
