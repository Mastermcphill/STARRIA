# STARRIA AGENT CONSTITUTION

This repository implements STARRIA 2026. Read this file before changing code.

## 1. PRODUCT CONSTITUTION

STARRIA is a global digital entertainment venue and star-making network.

North Star:
> STARRIA makes Stars.

Core product model:
> Person / Collective → Studio → Show → Experience → Audience → Economy → Discovery → Star Journey

Technical Arena rooms are implementation infrastructure beneath Experiences.

The product is not a generic social feed, TikTok clone, Twitch clone, Patreon clone, ticketing-only app, music-only app, or movie-only app.

## 2. CANONICAL LANGUAGE

Use these terms in new user-facing code:

- Stari, never STARRIA Coin
- Studio, not merely live room
- Experience, not merely livestream
- Attend, when referring to an Experience
- Collective / Act for shared identities
- Starria ID for persistent identity
- Star Journey for progression
- Gift for Stari supporter transfers
- Ticket / Pass for access entitlements

Existing internal `coin`, `event`, `arena`, `tap` names may remain temporarily where migration cost is high. Do not introduce new public terminology that conflicts with the constitution.

## 3. IDENTITY RULES

- One person has one persistent Starria ID.
- Collective identities link to underlying personal IDs.
- Do not create fake/duplicate user accounts to represent collaborations.
- Ownership and authorization must be server-side.
- Membership changes must affect access correctly.

## 4. MONEY / STARI RULES

- Stari is the only customer-facing entertainment currency.
- Every Stari movement must use the canonical wallet/ledger architecture.
- Never invent a second balance store.
- Money operations must be idempotent.
- Never trust a client-supplied balance or price as authoritative.
- Settlement and payout paths require strong transaction boundaries.

## 5. ACCESS RULES

- Tickets are entitlements.
- A Starria ID can hold multiple entitlements.
- Entitlement checks happen server-side.
- Paid Experience eligibility is gated by policy.
- Studio capability access is policy-driven, not blindly hardcoded from one follower-count threshold.

## 6. STAR ACCESS / MESSAGING

- Stars must be able to control who can contact them.
- Do not bypass Star Access for convenience.
- Direct messages, fan letters, event questions, collaboration requests and business contacts are distinct interaction types.
- Do not create an unrestricted celebrity inbox by default.

## 7. RIGHTS

- Protected media must use a rights-aware delivery model.
- A user's personal subscription/access to another service does not imply STARRIA redistribution rights.
- Never implement DRM bypasses or rights circumvention.
- Rights metadata should be explicit where protected content is involved.

## 8. NO-CODE-LIES RULE

Never leave UI pretending a feature works when backend support is missing.

Do not submit:

- fake API responses
- fake payment success
- placeholder repositories in production paths
- in-memory durable business data
- dead buttons
- unconnected screens
- silent TODOs for claimed functionality
- test stubs that hide real failures

If a feature cannot be completed in the current task, state exactly what remains.

## 9. LEGACY REPO RULE

Existing code is useful but not automatically the correct architecture.

Before extending a legacy domain:

1. Identify the current path.
2. Identify overlapping paths.
3. Check whether the capability already exists elsewhere.
4. Map the feature to the STARRIA 2026 ontology.
5. Preserve working infrastructure where practical.
6. Avoid creating another parallel subsystem.

## 10. TESTING

Every change must run the narrowest useful tests first and then the repository gates.

Minimum expectation:

- typecheck
- affected unit/integration tests
- affected E2E tests
- build where applicable
- Flutter analyze/tests for mobile changes
- Prisma migration validation for schema changes

Never weaken a test solely to make CI pass.

## 11. UI QUALITY

Every material screen must have:

- loading state
- empty state
- error state
- success/active state
- permission/access state where applicable
- clear current action
- responsive layout

STARRIA screens should feel like premium entertainment control surfaces, not cloned social-media screens.

The four conceptual UI layers are:

1. Experience Canvas
2. Live State
3. Command Surface
4. Discovery Thread

## 12. PR DISCIPLINE

Each PR should have one coherent outcome.

PR description must state:

- product objective
- affected STARRIA objects
- implementation summary
- tests run
- migrations
- known limitations
- whether architecture docs changed

## 13. HIGH-RISK CHANGES

Do not autonomously merge without designated approval for:

- payment settlement semantics
- Stari pricing/economics changes
- wallet/ledger logic with material impact
- identity/security model changes
- rights/distribution policy
- destructive production migrations
- deleting large amounts of user/content data
- breaking API changes with external consumers

## 14. ARCHITECTURE DRIFT CHECK

Before completing work, answer:

- Does this strengthen Person / Collective → Studio → Show → Experience → Audience → Economy → Discovery → Star Journey?
- Does it create a competing concept?
- Is there an existing subsystem that should be reused?
- Have I introduced an in-memory or fake production dependency?
- Have I created a new public term unnecessarily?
- Does this make STARRIA more like a competitor clone?

If the answer to any drift question is concerning, stop and document the issue rather than hiding it.