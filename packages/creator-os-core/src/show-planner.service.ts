// ---------------------------------------------------------------------------
// creator-os-core — ShowPlannerService (Sprint 7, Phase 5)
// Deterministically generates a segment breakdown for a show given its type,
// duration and audience size. Framework-agnostic; no external AI dependency —
// uses weighted segment templates scaled to the requested duration.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type { ShowPlan, ShowPlanRequest, ShowSegment, ShowType } from './studio.types';
import { buildShowPlanGenerated } from './studio.events';

interface SegmentTemplate {
  readonly title: string;
  readonly kind: string;
  readonly weight: number;        // relative share of total duration
  readonly description: string;
  /** Only include this segment when audience >= threshold (interaction segments). */
  readonly minAudience?: number;
}

// Weighted templates per show type. Weights are normalized to the requested duration.
const TEMPLATES: Record<ShowType, SegmentTemplate[]> = {
  STANDUP: [
    { title: 'Intro & Warm-up', kind: 'INTRO', weight: 4, description: 'Greet the crowd, set the tone, opening jokes.' },
    { title: 'Audience Interaction', kind: 'INTERACTION', weight: 3, description: 'Crowd work and call-outs.', minAudience: 25 },
    { title: 'Roast Battle', kind: 'PERFORMANCE', weight: 2, description: 'Rapid-fire roast segment.', minAudience: 50 },
    { title: 'Finale', kind: 'FINALE', weight: 3, description: 'Closing bit and sign-off.' },
  ],
  RAP_BATTLE: [
    { title: 'Intro & Rules', kind: 'INTRO', weight: 2, description: 'Introduce battlers and rules.' },
    { title: 'Round 1', kind: 'PERFORMANCE', weight: 3, description: 'First exchange of bars.' },
    { title: 'Audience Vote', kind: 'INTERACTION', weight: 1, description: 'Live audience scoring.', minAudience: 25 },
    { title: 'Round 2', kind: 'PERFORMANCE', weight: 3, description: 'Second exchange of bars.' },
    { title: 'Final Round & Result', kind: 'FINALE', weight: 3, description: 'Final bars and winner reveal.' },
  ],
  SING_OFF: [
    { title: 'Intro', kind: 'INTRO', weight: 2, description: 'Introduce performers.' },
    { title: 'First Performances', kind: 'PERFORMANCE', weight: 4, description: 'Each contestant performs.' },
    { title: 'Audience Vote', kind: 'INTERACTION', weight: 1, description: 'Crowd votes for favourites.', minAudience: 25 },
    { title: 'Final Performances', kind: 'PERFORMANCE', weight: 3, description: 'Top contestants sing again.' },
    { title: 'Results & Encore', kind: 'FINALE', weight: 2, description: 'Winner announced, encore.' },
  ],
  QA: [
    { title: 'Intro & Topic', kind: 'INTRO', weight: 2, description: 'Frame the session and topic.' },
    { title: 'Open Q&A', kind: 'INTERACTION', weight: 6, description: 'Answer audience questions.', minAudience: 10 },
    { title: 'Deep Dive', kind: 'PERFORMANCE', weight: 3, description: 'Long-form answer to a key question.' },
    { title: 'Wrap-up', kind: 'FINALE', weight: 1, description: 'Summary and next steps.' },
  ],
  AI_PREMIERE: [
    { title: 'Red-Carpet Intro', kind: 'INTRO', weight: 2, description: 'Hype and context for the premiere.' },
    { title: 'Feature Screening', kind: 'PERFORMANCE', weight: 6, description: 'Play the AI-generated feature.' },
    { title: 'Live Reactions', kind: 'INTERACTION', weight: 2, description: 'Audience reactions and chat highlights.', minAudience: 25 },
    { title: 'Creator Commentary & Outro', kind: 'FINALE', weight: 2, description: 'Behind-the-scenes and sign-off.' },
  ],
};

export interface ShowPlannerDeps {
  eventBus?: EventBus;
}

export class ShowPlannerService {
  constructor(private readonly deps: ShowPlannerDeps = {}) {}

  generate(req: ShowPlanRequest): ShowPlan {
    if (req.durationMinutes <= 0) throw new Error('durationMinutes must be positive.');

    const templates = TEMPLATES[req.showType].filter(
      (t) => t.minAudience === undefined || req.audienceSize >= t.minAudience,
    );

    const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);

    // Allocate whole minutes proportional to weight, distributing the remainder
    // so the segments sum exactly to durationMinutes.
    const raw = templates.map((t) => (t.weight / totalWeight) * req.durationMinutes);
    const floored = raw.map((m) => Math.floor(m));
    let remainder = req.durationMinutes - floored.reduce((a, b) => a + b, 0);

    // Hand out the remaining minutes to the largest fractional parts first.
    const fractions = raw
      .map((m, i) => ({ i, frac: m - Math.floor(m) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) {
      floored[fractions[k % fractions.length].i] += 1;
    }

    const segments: ShowSegment[] = templates.map((t, i) => ({
      order: i + 1,
      title: t.title,
      minutes: Math.max(1, floored[i]),
      kind: t.kind,
      description: t.description,
    }));

    const plan: ShowPlan = {
      id: randomUUID(),
      creatorId: req.creatorId,
      showType: req.showType,
      durationMinutes: req.durationMinutes,
      audienceSize: req.audienceSize,
      segments,
      generatedAt: new Date().toISOString(),
    };

    this.deps.eventBus?.publish(buildShowPlanGenerated({
      planId: plan.id, creatorId: plan.creatorId, showType: plan.showType,
      durationMinutes: plan.durationMinutes, audienceSize: plan.audienceSize,
      segmentCount: plan.segments.length, generatedAt: plan.generatedAt,
    }));

    return plan;
  }
}
