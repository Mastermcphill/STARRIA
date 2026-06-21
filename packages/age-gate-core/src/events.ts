import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import {
  AGE_GATE_PASSED,
  AGE_GATE_FAILED,
  CONSENT_RECORDED,
} from '@starria/domain-events';
import type {
  AgeGatePassedEvent,
  AgeGateFailedEvent,
  ConsentRecordedEvent,
  AgeGateLevel,
} from '@starria/domain-events';
import type { VerificationMethod, ConsentType } from './types';

export function buildAgeGatePassed(params: {
  userId: string;
  level: AgeGateLevel;
  verificationMethod: VerificationMethod;
  passedAt: string;
}): AgeGatePassedEvent {
  return createEvent({
    id: randomUUID(),
    type: AGE_GATE_PASSED,
    aggregateId: params.userId,
    aggregateType: 'AgeGateProfile',
    payload: params,
  });
}

export function buildAgeGateFailed(params: {
  userId: string;
  level: AgeGateLevel;
  reason: string;
  failedAt: string;
}): AgeGateFailedEvent {
  return createEvent({
    id: randomUUID(),
    type: AGE_GATE_FAILED,
    aggregateId: params.userId,
    aggregateType: 'AgeGateProfile',
    payload: params,
  });
}

export function buildConsentRecorded(params: {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  recordedAt: string;
  ipAddress?: string;
}): ConsentRecordedEvent {
  return createEvent({
    id: randomUUID(),
    type: CONSENT_RECORDED,
    aggregateId: params.userId,
    aggregateType: 'ConsentRecord',
    payload: params,
  });
}
