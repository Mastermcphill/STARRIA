# STARRIA AUTONOMOUS ENGINEERING OPERATING SYSTEM

**Purpose:** Operate STARRIA as a high-autonomy software organization while keeping product authority, financial safety, security and major architectural decisions under explicit control.

---

# 1. OPERATING MODEL

The system is not one giant coding agent.

It is a coordinated group of specialized agents operating against:

1. STARRIA 2026 Master Product Blueprint
2. `AGENTS.md`
3. repository source of truth
4. executable tests
5. architecture documentation
6. CI/CD results
7. runtime telemetry

The agents should behave like a small software company:

```text
                         STARRIA BLUEPRINT
                                │
                                ▼
                       PRODUCT / ARCHITECT
                                │
                        prioritized backlog
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
         Backend Agent      Flutter Agent      Platform Agent
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
                              GitHub
                                │
                                ▼
                           CI / QA Gate
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
                PASS ✅                    FAIL ❌
                   │                         │
                   │                   Repair Agent
                   │                         │
                   │                    rerun CI
                   │                         │
                   └────────────┬────────────┘
                                ▼
                         Review / Policy Gate
                                │
                                ▼
                             Deploy
                                │
                                ▼
                           Monitoring
                                │
                                ▼
                         Backlog generator
```

---

# 2. AGENT ROLES

## 2.1 Master Architect Agent

Responsibilities:

- interpret the blueprint
- break initiatives into dependency-aware tasks
- detect architecture conflicts
- identify reuse opportunities
- prevent duplicate subsystems
- update architecture notes
- reject work that contradicts product constitution

It may propose architecture.

It may not silently redefine the blueprint.

## 2.2 Backend Builder Agent

Responsibilities:

- NestJS modules
- Prisma schema/migrations
- APIs
- authorization
- domain logic
- integration tests
- service boundaries

## 2.3 Flutter Builder Agent

Responsibilities:

- screens
- navigation
- state management
- repository wiring
- user flows
- visual states
- mobile integration tests

## 2.4 Media / Live Agent

Responsibilities:

- LiveKit
- screen sharing
- live stages
- participant roles
- replay
- media pipelines
- content source abstraction

## 2.5 Economy Agent

Responsibilities:

- Stari
- wallet
- tickets
- entitlement engine
- gifts
- payouts
- pricing

High-risk money changes remain approval-gated.

## 2.6 Trust / Security Agent

Responsibilities:

- access control
- abuse paths
- identity
- rate limits
- moderation
- suspicious patterns
- privilege escalation
- data exposure

## 2.7 Test / QA Agent

Responsibilities:

- unit tests
- integration tests
- E2E tests
- regression tests
- failure reproduction
- test gap detection

## 2.8 Visual QA Agent

Responsibilities:

- verify screen states
- detect placeholder UIs
- ensure navigation connects to real actions
- assess layout regressions
- enforce STARRIA visual constitution

## 2.9 No-Code-Lies Agent

Continuously scan for:

- TODO-only production paths
- stubs
- fake repositories
- hardcoded data
- mock responses
- placeholder screens
- dead endpoints
- dead buttons
- unhandled failure states
- disconnected client/backend flows

## 2.10 Release / Operations Agent

Responsibilities:

- deployment readiness
- migration safety checks
- environment checks
- smoke tests
- health checks
- rollback readiness
- incident triage

---

# 3. BACKLOG STRUCTURE

The autonomous system should operate on this hierarchy:

```text
VISION
  → PILLAR
    → DOMAIN
      → EPIC
        → TASK
          → SUBTASK
```

Example:

```text
Star-making
  → Studios
    → Studio eligibility
      → Capability policy
        → Persist eligibility state
        → API resolver
        → Flutter gate
        → Tests
```

Every task must identify the STARRIA object(s) it changes.

---

# 4. TASK CONTRACT

Every generated engineering task should contain:

- task ID
- product pillar
- domain
- objective
- user story
- affected canonical objects
- dependencies
- acceptance criteria
- API impact
- data-model impact
- UI impact
- security impact
- money impact
- rights impact
- tests required
- observability required
- rollback/compatibility notes

A task without acceptance criteria should not enter autonomous implementation.

---

# 5. AUTONOMOUS LOOP

For each task:

## Step 1: Repository reconnaissance

Agent inspects:

- existing implementations
- relevant Prisma models
- controllers/services
- client routes
- tests
- package dependencies
- architecture docs

## Step 2: Plan

Agent writes a short plan and identifies:

- reuse
- new components
- migration
- test plan
- risk level

## Step 3: Build

Agent implements the smallest coherent vertical slice.

## Step 4: Test locally

Run narrow tests first.

## Step 5: Full gates

Run repository CI.

## Step 6: Peer review

A separate reviewer agent inspects:

- architecture
- security
- tests
- product conformity

## Step 7: Repair

If CI/review fails, return logs/findings to the responsible agent.

Agent may repair and rerun automatically.

## Step 8: Merge gate

Low-risk PRs can auto-merge when all configured gates are green.

High-risk PRs stop for human approval.

## Step 9: Deploy

Deploy only according to release policy.

## Step 10: Smoke / monitor

Run post-deploy health checks.

## Step 11: Generate follow-up work

Detected defects and missing coverage become backlog tasks.

---

# 6. PR AUTOMATION POLICY

Each autonomous PR should have:

- one objective
- linked task ID
- summary
- architectural impact
- test evidence
- migration evidence
- known limitations

Auto-merge prerequisites:

- CI green
- no unresolved review comments
- architecture checker passes
- security checker passes for relevant surfaces
- no high-risk classification
- no unapproved schema/data change

---

# 7. RISK CLASSES

## LOW

Examples:

- copy changes
- isolated UI polish
- non-critical tests
- internal refactors with no schema/API effect

Can be fully autonomous if CI passes.

## MEDIUM

Examples:

- new domain endpoint
- new mobile flow
- non-financial data migration
- significant discovery changes

Autonomous implementation; auto-merge can be permitted after reviewer gates.

## HIGH

Examples:

- wallet/ledger changes
- Stari economics
- payout changes
- identity changes
- authentication/authorization changes
- rights/distribution logic
- destructive migrations
- privacy-sensitive data flows

Requires human approval at merge/release.

---

# 8. TESTING LAYERS

## Layer 1: Static

- typecheck
- formatting where policy requires
- lint where configured
- dependency checks

## Layer 2: Unit

Business rules and pure domain logic.

## Layer 3: Integration

Database/repository/provider contracts.

## Layer 4: E2E

User journeys.

Examples:

- create Studio
- schedule Experience
- purchase ticket
- enter preview
- upgrade ticket
- join live room
- stage invitation
- send Gift
- buy music
- movie Premiere
- Star Access message

## Layer 5: Visual

Validate major mobile flows and critical screens.

## Layer 6: Smoke

After deployment:

- API health
- authentication
- wallet read
- ticket read
- live-room availability where enabled
- key mobile/API integration endpoints

---

# 9. CI REPAIR LOOP

When CI fails:

1. capture exact failed job
2. capture logs
3. classify failure
4. map to owning agent
5. create repair attempt
6. rerun affected tests
7. rerun full CI
8. cap repeated retries
9. escalate with diagnostic report if unresolved

Never change CI to hide a failing product test unless the test itself is intentionally being replaced and the replacement preserves or improves coverage.

---

# 10. NO-CODE-LIES SCANNER

The autonomous system should periodically scan the repository for patterns such as:

```text
TODO: implement
not implemented
stub
mock
fake
placeholder
in-memory
hardcoded response
return true
return []
return {}
throw new Error('TODO')
```

This scan is advisory until a human has reviewed the false-positive profile, but it should produce a regular **STARRIA Reality Report**:

```text
Implemented
Partially implemented
Stubbed
Disconnected
Broken
Deprecated
Missing
```

The goal is transparency, not automatic deletion.

---

# 11. ARCHITECTURE DRIFT CONTROL

Before merging a new domain, the architect agent must ask:

1. Does an existing package already provide this capability?
2. Is the new concept represented in the Master Blueprint?
3. Is this an implementation detail or a new product object?
4. Does it create a competing currency/ledger?
5. Does it duplicate Star/Studio/Experience concepts?
6. Does it create a second authorization model?
7. Does it bypass rights management?
8. Does it accidentally turn STARRIA into a competitor clone?

If yes, stop and raise an architecture finding.

---

# 12. DATABASE MIGRATION POLICY

Every schema change must state:

- why the field/table is needed
- owning domain
- data ownership
- indexes
- uniqueness
- nullability
- backfill plan
- compatibility with existing rows
- rollback/forward plan
- API version impact

Destructive operations are high risk.

---

# 13. FINANCIAL SAFETY POLICY

Financial features must satisfy:

- idempotency
- canonical ledger use
- transactional correctness
- replay protection
- audit trail
- exact amount/currency validation
- no client-authoritative balances
- failure/retry semantics

Payout and settlement flows require explicit approval for materially different economics.

---

# 14. RIGHTS SAFETY POLICY

Any feature involving:

- film
- television
- sports
- music
- third-party video
- streaming services

must declare its rights mode:

```text
NO_PROTECTED_CONTENT
ENTITLED_COVIEW
LICENSED_STARRIA_BROADCAST
PARTNER_DELIVERY
```

The agent must never infer distribution rights.

---

# 15. UI AUTONOMY POLICY

A mobile agent should implement full states, not only happy-path screenshots.

Required states where relevant:

- loading
- empty
- error
- access denied
- ticket required
- preview active
- purchase success
- live
- ended
- replay
- offline/degraded

The visual QA agent should reject obvious placeholders, broken routes and dead controls.

---

# 16. DEPLOYMENT POLICY

Preferred sequence:

```text
PR
 ↓
CI
 ↓
Review gates
 ↓
Merge
 ↓
Staging / preview
 ↓
Smoke tests
 ↓
Production
 ↓
Post-deploy smoke
 ↓
Monitoring
```

Production deployment can be automated for low/medium-risk changes.

High-risk changes require approval.

---

# 17. MONITORING → ENGINEERING LOOP

Runtime monitoring should automatically create engineering signals for:

- crash spikes
- API error-rate spikes
- latency regressions
- failed payment callbacks
- ticket access failures
- live-room join failures
- replay failures
- message delivery failures
- moderation backlog growth

The system may create tasks automatically.

It must not silently alter production business logic in response to telemetry.

---

# 18. AUTONOMY LEVELS

### Level 0: Human-only

Concept and architecture.

### Level 1: Agent-assisted

Human picks task; agent codes.

### Level 2: Agent-planned

Agent decomposes approved epic into tasks.

### Level 3: Agent-executed

Agents build, test, repair and open PRs.

### Level 4: Agent-operated

Agents merge low-risk changes, deploy, monitor and repair.

### Level 5: Autonomous engineering organization

Agents continuously maintain the backlog, repair regressions, improve tests, reduce technical debt and execute approved roadmap work.

STARRIA should target **Level 4 for low/medium-risk engineering**, with Level 5 for bounded maintenance and QA. Product, financial, security and rights authority remains explicitly governed.

---

# 19. RECOMMENDED TOOLING MODEL

Use multiple agents rather than one universal agent.

A practical setup is:

- Codex: primary high-autonomy engineering/orchestration layer
- Jules: parallel implementation and CI-repair worker
- GitHub Actions: authoritative automated quality gate
- Render: deployment/runtime platform where appropriate
- Supabase/Postgres: persistent data platform where appropriate
- Monitoring/logging: automated signal source

The exact provider mix can change without changing this operating model.

---

# 20. HUMAN DASHBOARD

The human should not review every line of code.

They should receive:

### Daily / run report

```text
STARRIA AUTONOMOUS BUILD REPORT

Tasks completed: 14
PRs opened: 7
PRs merged: 5
CI failures auto-repaired: 3
Architecture findings: 2
Security findings: 0
High-risk approvals required: 1
Production regressions: 0
Technical-debt tasks generated: 8
```

### Human attention queue

Only high-value decisions should reach the human:

- architecture conflict
- major product ambiguity
- financial change
- security risk
- rights question
- destructive data change
- repeated autonomous failure

---

# 21. THE TARGET STATE

The end goal is not:

> "An AI writes code without asking me anything."

The end goal is:

> **"STARRIA has a machine-operated engineering organization that can take an approved product roadmap, safely implement it, test it, repair failures, monitor it and continuously reduce technical debt without requiring a human to supervise every implementation detail."**

The human remains the source of product intent and the approver of high-risk policy.