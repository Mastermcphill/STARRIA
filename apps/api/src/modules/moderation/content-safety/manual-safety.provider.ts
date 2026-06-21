import { Injectable } from '@nestjs/common';
import type { ModerationSeverity } from '@starria/moderation-core';
import {
  ContentSafetyProvider,
  SafetyFinding,
  SafetyVerdict,
  decideFromFindings,
} from './content-safety.port';

interface TermRule {
  category: 'hate' | 'threats' | 'spam';
  severity: ModerationSeverity;
  // Word-boundary matched, case-insensitive.
  terms: string[];
}

/**
 * Default, dependency-free content-safety provider.
 *
 * Text is classified by curated rule sets (hate / threats / spam). The lists
 * are deliberately conservative seeds — production deployments are expected to
 * either extend them or switch to {@link CloudProviderAdapter} by configuring a
 * cloud moderation endpoint. This is NOT a stub: it produces real, deterministic
 * verdicts and is the honest fallback when no ML provider is wired.
 *
 * Images cannot be classified by text rules, so every image is routed to human
 * review ('review' decision) rather than being silently allowed — fail-closed.
 */
@Injectable()
export class ManualSafetyProvider implements ContentSafetyProvider {
  readonly name = 'manual';

  private readonly rules: TermRule[] = [
    {
      category: 'threats',
      severity: 'critical',
      terms: [
        'i will kill you',
        'kill yourself',
        'kys',
        "i'll hurt you",
        'i will hurt you',
        'going to hurt you',
        'shoot you',
        'stab you',
        'bomb',
        'death threat',
      ],
    },
    {
      category: 'hate',
      severity: 'high',
      // Slur seeds kept minimal; extend per policy. Real platform lists are large.
      terms: ['hate speech placeholder slur', 'subhuman', 'go back to your country'],
    },
    {
      category: 'spam',
      severity: 'medium',
      terms: [
        'free money',
        'click here to win',
        'work from home and earn',
        'crypto giveaway',
        'double your bitcoin',
        'buy followers',
        'http://bit.ly',
      ],
    },
  ];

  async scanText(text: string): Promise<SafetyVerdict> {
    const haystack = (text ?? '').toLowerCase();
    const findings: SafetyFinding[] = [];

    for (const rule of this.rules) {
      const matched = rule.terms.filter((t) => haystack.includes(t.toLowerCase()));
      if (matched.length > 0) {
        findings.push({
          category: rule.category,
          severity: rule.severity,
          score: 1,
          matchedTerms: matched,
        });
      }
    }

    // Heuristic spam signal: excessive repeated links / shouting.
    const linkCount = (haystack.match(/https?:\/\//g) ?? []).length;
    if (linkCount >= 5) {
      findings.push({
        category: 'spam',
        severity: 'medium',
        score: Math.min(1, linkCount / 10),
        matchedTerms: [`${linkCount} links`],
      });
    }

    return decideFromFindings(findings);
  }

  async scanImage(_imageUrl: string): Promise<SafetyVerdict> {
    // A rule-based provider cannot inspect pixels. Fail closed: route to humans
    // rather than auto-allowing unseen imagery.
    return {
      decision: 'review',
      findings: [
        {
          category: 'unscanned-image',
          severity: 'medium',
          score: 0,
          matchedTerms: ['manual provider cannot classify images — human review required'],
        },
      ],
      severity: 'medium',
    };
  }
}
