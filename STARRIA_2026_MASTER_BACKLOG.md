# STARRIA 2026 MASTER EXECUTION BACKLOG

**Status:** Dependency-ordered planning baseline
**Date:** 2 October 2026
**Repository:** `Mastermcphill/STARRIA`
**Current inspected main:** `e3fa4da3f3eaa897f7db4b464916602ad860329d`
**Currency:** `Stari`

## 0. Purpose

This backlog translates the STARRIA 2026 Master Product Blueprint into an executable dependency graph for autonomous engineering agents.

It is intentionally ordered. Agents must not skip foundational epics merely because a later feature is more visible or exciting.

The backlog is a planning authority, not permission to merge high-risk changes without the gates defined in `AGENTS.md` and `STARRIA_AUTONOMOUS_ENGINEERING_OS.md`.

---

# 1. DELIVERY PRINCIPLES

1. **Product before code.** The blueprint defines the product. Existing code does not redefine it.
2. **Foundation before spectacle.** Identity, authorization, domain objects, entitlement, ledger integrity and observability come before advanced live/media experiences.
3. **One canonical path.** Reuse working repository infrastructure instead of creating parallel systems.
4. **No fake completeness.** A feature is not complete because its screen exists.
5. **Every capability ends in a testable user journey.** Backend, Flutter, data and permissions must agree.
6. **Migration over duplication.** Where an old model already exists, prefer an explicit compatibility layer and a controlled migration path.
7. **High-risk gates stay human-controlled.** Stari settlement, identity/security, rights, destructive migrations and production financial changes require approval.
8. **Autonomy increases as certainty increases.** Agents may execute routine low-risk work independently; they must stop at policy boundaries.

---

# 2. CURRENT REPOSITORY RECONCILIATION

The current repo already contains valuable machinery, but its primary data model is still centered on `User -> StarProfile -> Event -> Arena`.

### KEEP / REUSE

- `apps/api` NestJS + Fastify foundation
- `apps/mobile` Flutter foundation
- PostgreSQL + Prisma
- Redis
- JWT authentication and refresh/revocation flow
- wallet / canonical ledger infrastructure
- gifting infrastructure
- payout infrastructure
- ticketing infrastructure, subject to finalization of its transitional data model
- LiveKit adapter and live room machinery
- replay infrastructure
- messaging infrastructure
- moderation / trust infrastructure
- discovery/search foundations
- creator OS foundations
- patron/supporter foundations
- battles/voting foundations
- analytics/event infrastructure
- CI workflow and existing E2E suites

### RESHAPE

- `StarProfile` -> Star/Rising Star capability model
- `Event` -> Show/Experience compatibility layer
- `Arena` -> technical room beneath Experience
- `SupporterProfile` -> Supporter + relationship/status model
- `Subscription` -> supporter relationship product where still appropriate
- `Tap` -> Gift/legacy transaction compatibility model
- `CreatorHouse` -> evaluate as predecessor to Collective/Act
- Prestige -> Star Journey/status system
- Creator OS -> Studio/Show production OS
- Discovery/feed -> attendance-first Experience discovery
- Live stage -> Experience stage/participation engine
- ticketing -> entitlement engine

### QUARANTINE / REVIEW BEFORE EXPANDING

- in-memory presence as durable business state
- in-memory session billing
- stub poster / clip / analytics sources
- stub video transcoding / thumbnail / metadata paths
- stub replay access/discovery pieces
- stub LiveKit provider in session engine
- transient ticketing record path
- legacy empty Stars/Taps/Events/Arenas services/controllers
- mobile placeholder repositories/routes

### REPLACE / BUILD NEW

- first-class Collective/Act identity
- first-class Studio
- capability policy engine
- unified Show/Experience domain
- ticket entitlement engine with multi-ticket ownership
- Preview Window / Live Admission Curve
- Star Access / message eligibility system
- official media store and purchased-content library
- music / album / video product model
- film / premiere / watchlist / demand model
- rights-aware content source and Rights Package
- Co-View orchestration
- commercial inventory / sponsorship engine
- audience segmentation and ad decisioning layer
- Experience Grid / attendance-first recommendation model
- Star Journey / Greenlight / First 100 systems
- stage and role orchestration
- Audience Pulse / live intelligence
- visual design system based on Experience Canvas + Live State + Command Surface + Discovery Thread
- autonomous product/engineering telemetry loop

---

# 3. DEPENDENCY GRAPH

```text
B00 Product/architecture freeze
        |
        v
B01 Repository baseline + legacy containment
        |
        +-------------------+
        |                   |
        v                   v
B02 Domain identity     B03 Platform safety/observability
        |
        v
B04 Social graph + Star eligibility
        |
        +----------+-----------+
        |          |           |
        v          v           v
B05 Studios    B06 Stari      B07 Star Access
        |          |           |
        +----------+-----------+
                   |
                   v
              B08 Shows/Experiences
                   |
          +--------+---------+----------------+
          |                  |                |
          v                  v                v
     B09 Ticketing      B10 Live Stage    B11 Discovery
          |                  |                |
          +--------+---------+----------------+
                   |
                   v
              B12 Live Economy
                   |
       +-----------+-----------+
       |           |           |
       v           v           v
   B13 Music    B14 Film     B15 Co-View/Rights
       |           |           |
       +-----------+-----------+
                   v
              B16 Ads/Commercial
                   |
                   v
              B17 Star Forge
                   |
                   v
              B18 AI Showrunner
                   |
                   v
              B19 Globalization
                   |
                   v
              B20 Scale/Autonomy
```

Some epics can develop in parallel once their prerequisites are satisfied. Cross-domain integration must respect the dependency graph.

---

# 4. PHASE 0 — GOVERNANCE AND REPOSITORY RESET

## B00 — Product and architecture freeze

**Objective:** Make the 2026 blueprint the authoritative source of product truth.

### B00.1 Canonical terminology registry

Define machine-readable canonical terms:

- Stari
- Starria ID
- Person
- Star
- Rising Star
- Supporter
- Follower/Connection
- Collective/Act
- Organization
- Studio
- Show
- Experience
- Arena
- Stage
- Audience
- Ticket
- Pass
- Gift
- Premiere
- Co-View
- Watchlist
- Star Journey
- Greenlight
- Audience Pulse
- Star Access
- Rights Package
- Commercial Inventory

**Gate:** no new public feature may invent a competing term.

### B00.2 Product invariant registry

Encode non-negotiables from the Blueprint and `AGENTS.md` into machine-readable policy.

### B00.3 Domain ownership map

For every current module/package identify its future canonical domain.

**Done when:** an autonomous agent can determine where a new feature belongs without inventing a domain.

---

## B01 — Repository reality baseline

**Objective:** Establish the actual current-state baseline before major migration.

### B01.1 Current architecture scan

Produce automated inventory of:

- API modules
- Flutter feature folders/routes
- packages
- Prisma models/enums
- migrations
- TODO/stub/in-memory markers
- tests
- CI workflows

### B01.2 Legacy compatibility register

Track every legacy module being retained temporarily.

### B01.3 No-Code-Lies scanner

Build a repository checker that flags claimed functionality with stubbed or disconnected implementation.

### B01.4 Test baseline

Run and record current typecheck, API tests, E2E, Flutter analyze/tests and builds.

**Gate:** baseline report is stored before domain migration begins.

---

# 5. PHASE 1 — IDENTITY, ACCESS AND RELATIONSHIPS

## B02 — Canonical Starria identity model

**Depends on:** B00, B01

**Objective:** Separate persistent human identity from entertainment identities built on top of it.

### B02.1 Person / Starria ID contract

Preserve one persistent identity per person.

### B02.2 Collective / Act model

Support multiple Starria IDs owning/managing one shared identity.

Requirements:

- owner
- member
- manager
- producer
- moderator
- finance role
- membership lifecycle
- invitation
- acceptance
- removal
- leave
- audit trail

### B02.3 Organization identity foundation

Prepare organization ownership without requiring a separate product later.

### B02.4 Authorization matrix

Centralize identity-level permissions.

### B02.5 Identity migration compatibility

Map existing `User`, `StarProfile` and `CreatorHouse` concepts into the new model without duplicate identities.

**Acceptance:** a two-person Act can own a Studio and a Show while each person retains their personal account.

---

## B03 — Trust, safety and observability foundation

**Depends on:** B02

Strengthen:

- rate limiting
- audit logs
- moderation hooks
- privilege escalation tests
- account recovery
- suspicious activity signals
- event tracing
- structured domain events
- operational metrics

**Gate:** all new high-value domains must emit auditable events.

---

## B04 — Connections, Followers and Star eligibility

**Depends on:** B02, B03

### B04.1 Follow/connection graph

First-class relationships with history.

### B04.2 Connection quality signals

Track meaningful indicators such as longevity, attendance, repeat participation and interaction without turning the public profile into a crude scorecard.

### B04.3 Studio capability policy engine

Create policy-driven capability checks rather than hardcoded follower thresholds.

### B04.4 Established-Star verification route

Allow established entertainers to receive appropriate verified capabilities without requiring organic STARRIA growth first.

### B04.5 Rising Star state

Create a formal progression state based on configurable evidence of momentum.

### B04.6 Discovery Missions

Create safe engagement missions that can reward meaningful discovery with Stari where policy permits.

**High-risk:** reward/economy mechanics require Economy Agent review.

---

# 6. PHASE 2 — STUDIO, SHOW AND EXPERIENCE CORE

## B05 — Studio platform

**Depends on:** B02, B03, B04

### B05.1 Studio entity

Ownership by Person, Collective or Organization.

### B05.2 Studio management roles

Owner/co-owner/manager/producer/stage manager/moderator/content/commercial/finance.

### B05.3 Studio capability ladder

Capabilities are policy-based.

### B05.4 Studio homepage

The persistent digital venue containing:

- upcoming Experiences
- live status
- content catalogue
- purchased media
- replays
- fan relationships
- store
- messages/access points
- commercial inventory

### B05.5 Studio administration

Create/edit/archive Studio, staff management, audit trail.

**Acceptance:** a Collective can operate a shared Studio without creating fake user accounts.

---

## B06 — Stari economy foundation

**Depends on:** B01, B02

### B06.1 Canonical customer-facing currency name

All user-facing language becomes **Stari**.

### B06.2 Wallet compatibility

Retain canonical ledger, hash chain and idempotency.

### B06.3 Stari pricing registry

Centralize pricing and package definitions. No client-side authoritative price.

### B06.4 Purchase ledger / transaction taxonomy

Separate purchase, ticket, gift, content purchase, upgrade, refund and payout concepts even when sharing the same wallet.

### B06.5 Refund/chargeback/reversal policy

Define behavior before commercial Experiences become public.

**High-risk approval required.**

---

## B07 — Star Access and messaging

**Depends on:** B02, B03, B04

### B07.1 Access policy engine

A Star controls who can contact them.

### B07.2 Message types

Separate:

- direct message
- fan letter
- event question
- collaboration request
- business contact

### B07.3 Eligibility signals

Support configurable combinations of:

- connection status
- trust state
- Star/supporter status
- event attendance
- earned access badges
- creator-issued access

### B07.4 Celebrity inbox architecture

Priority / collaboration / audience / business / request queues.

### B07.5 Message context cards

Show useful relationship context to the Star without exposing unnecessary personal data.

### B07.6 Fan-to-Star AI triage

Classification and summarization only at first. No autonomous sending as the creator.

---

# 7. PHASE 3 — SHOW / EXPERIENCE / TICKETING ENGINE

## B08 — Show and Experience domain

**Depends on:** B05, B06

### B08.1 Show entity

Reusable production definition.

### B08.2 Experience entity

Specific scheduled occurrence.

### B08.3 Experience lifecycle

Draft → Greenlight → Published → Scheduled → Live → Ended → Replay/Archive → Cancelled.

### B08.4 Experience types

Flexible taxonomy supporting:

- comedy
- concert
- film premiere
- music release
- watch/co-view
- talk show
- analysis
- debate
- Face-Off
- gaming
- class
- fan experience

Do not hardwire every future format into an enum when a configurable type system is more appropriate.

### B08.5 Experience composition

Support parent Experience + child moments/rooms:

- lobby
- main stage
- VIP
- VVIP
- backstage
- audience discussion
- afterparty

---

## B09 — Ticket and entitlement engine

**Depends on:** B08, B06, B03

### B09.1 Ticket product

Ticket purchased using Stari.

### B09.2 Ticket ownership

A Starria ID can own multiple tickets and multiple event entitlements.

### B09.3 Access zones

Standard / VIP / VVIP / backstage / afterparty / replay / other creator-defined entitlements.

### B09.4 Ticket transfer / gifting

Policy-controlled transfer between Starria IDs.

### B09.5 Preview Window

Creator chooses preview duration, including zero.

### B09.6 Live Admission Curve

Configurable time-based pricing for late entry.

### B09.7 Early-buyer value

Replay, priority access and/or creator-defined benefits protect early buyers when late admission becomes cheaper.

### B09.8 Refund / cancellation / show failure

Explicit settlement behavior.

### B09.9 Existing ticketing migration

Replace transitional ticket paths with final entitlement model.

**High-risk approval required for settlement/refund semantics.**

---

# 8. PHASE 4 — LIVE STAGE AND AUDIENCE PARTICIPATION

## B10 — Experience Stage Engine

**Depends on:** B08, B09, B03

### B10.1 Stage roles

Host, co-host, guest, panelist, audience participant, moderator, producer.

### B10.2 Audience promotion

Audience member → invited/requested stage participant → active participant → return to audience.

### B10.3 Multi-host / Collective stage

Multiple identities can operate one Experience.

### B10.4 Stage permissions

Camera, mic, screen share, playback, moderation, poll creation and audience invitation.

### B10.5 Screen/share content source

Abstract source types rather than a simple `screenShare=true` boolean.

### B10.6 Live reactions, questions and polls

Native Experience interaction layer.

### B10.7 Audience Pulse

Aggregate live indicators without exposing sensitive per-user data.

### B10.8 Participant recognition

Separate:

- Supporter recognition
- Star recognition
- Host/Stage identity

Use subtle visual language rather than copying flying profile animations.

### B10.9 LiveKit mapping

Reuse current LiveKit adapter and v2 live room capability.

---

# 9. PHASE 5 — EXPERIENCE DISCOVERY AND STAR FORGE

## B11 — Attendance-first discovery

**Depends on:** B04, B08

### B11.1 Experience Grid

Discover:

- Live now
- Starting soon
- Tonight
- Upcoming
- Emerging Stars
- Major Stars
- Global discoveries

### B11.2 Intent model

Track meaningful signals:

- watchlist
- reminder
- preview entry
- attendance
- purchase
- repeat attendance
- follow after attendance

### B11.3 Recommendation model

Primary question:

> What should this person attend now?

### B11.4 Cross-cultural discovery

Language/category/region-aware discovery.

### B11.5 Creator matchmaking

Suggest collaborations based on audience overlap and content compatibility.

---

## B12 — Live economy integration

**Depends on:** B06, B09, B10

### B12.1 Gifts

Migrate public language from legacy taps to Gifts.

### B12.2 Top supporter recognition

Supporter tiers/markers with clear anti-abuse rules.

### B12.3 Event-linked gifts

Attribute gifts to Experience/Studio/Star/Collective.

### B12.4 Creator earnings attribution

Define how revenue is attributed across Collective members and rights owners.

### B12.5 Payouts

Retain current payout infrastructure; integrate with new transaction taxonomy.

**High-risk approval required.**

---

# 10. PHASE 6 — MUSIC / DIGITAL MEDIA STORE

## B13 — Artist Studio and music commerce

**Depends on:** B05, B06, B08, B09

### B13.1 Artist catalogue

Artist, song, album, EP, music video, artwork and metadata.

### B13.2 Direct Stari purchase

Buy directly inside STARRIA.

### B13.3 Purchased-content library

A purchaser can return to STARRIA and access eligible purchased content again under the applicable rights/license terms.

### B13.4 Download delivery

Secure, rights-controlled downloadable delivery where permitted.

### B13.5 Music video attachment

Purchased song may include associated video when rights allow.

### B13.6 Album launch Experience

Listening party, live artist appearance, sing-along, fan stage and afterparty.

### B13.7 Sing-Along mode

Synchronized lyrics and audience participation where rights permit.

### B13.8 Emerging artist path

One-hit / early-stage artist can sell a track and use Experience history to build Star Journey evidence.

**Rights and payout review required.**

---

# 11. PHASE 7 — FILM / NOLLYWOOD / SCREEN ECOSYSTEM

## B14 — Film and Premiere system

**Depends on:** B05, B06, B08, B09, B11, B15

### B14.1 Film entity

Title, synopsis, cast, crew, production entity, media assets, rights package.

### B14.2 Coming Soon page

Trailer, follow, watchlist, notify, premiere date.

### B14.3 Demand / Greenlight page

Measure interest before commercial commitment.

### B14.4 Premiere Experience

Countdown → premiere → post-film interaction.

### B14.5 Cast / creator stage

Invite selected supporters or random eligible audience members to participate after the content.

### B14.6 Premium / free / promotional windows

Flexible monetization under rights constraints.

### B14.7 Film library

Purchased/entitled films remain discoverable from the user's STARRIA library according to rights.

### B14.8 African cinema discovery

Nollywood, Ghanaian, Kenyan, South African and other regional categories without creating a separate app.

### B14.9 Global diaspora discovery

Discoverability for regional cinema to audiences outside its production country.

---

# 12. PHASE 8 — RIGHTS AND CO-VIEW

## B15 — Rights-aware content system

**Depends on:** B03, B08

### B15.1 Rights Package

Track, as applicable:

- owner/licensor
- permitted use
- territory
- start/end window
- audience restrictions
- monetization mode
- delivery mode
- source type
- takedown state

### B15.2 Content-source abstraction

Possible modes:

- STARRIA-hosted content
- licensed STARRIA distribution
- authorized co-view
- creator-owned stream
- external source with controlled integration

### B15.3 Rights enforcement hooks

Prevent an entitlement path from bypassing rights policy.

### B15.4 Auditability

Every protected content Experience should have a rights decision trail.

---

## B15.5 Co-View

**Depends on:** B10, B15.1–B15.4

Create synchronized viewing experiences with:

- synchronized timing
- host controls
- live comments
- stage guests
- polls
- reactions
- audience questions
- replay rules
- advertising hooks

Never implement DRM bypass or use of third-party content without appropriate authorization.

---

# 13. PHASE 9 — ADVERTISING AND COMMERCIAL NETWORK

## B16 — STARRIA Entertainment Advertising Network

**Depends on:** B08, B11, B15, B03

### B16.1 Commercial inventory model

Inventory attached to:

- Studio
- Show
- Experience
- Premiere
- discovery surfaces
- transition moments

### B16.2 Creator vs STARRIA inventory

Separate ownership, permissions and revenue attribution.

### B16.3 Ad formats

- full-screen
- side-by-side
- lower-third
- corner overlay
- sponsored poll
- sponsored countdown
- sponsored room
- sponsored moment

### B16.4 Frequency / annoyance control

Global frequency caps and Experience-specific rules.

### B16.5 Audience segmentation

Privacy-conscious aggregated targeting by relevant interests/contexts.

### B16.6 Small-business campaign console

Budget, geography, category, audience, schedule and inventory selection.

### B16.7 Brand / sponsorship packages

Premiere sponsor, Studio sponsor, Experience sponsor, segment sponsor.

### B16.8 Measurement

Impressions, completed views, interaction, attendance influence and attributable actions subject to privacy rules.

**Commercial/legal review required.**

---

# 14. PHASE 10 — STAR FORGE / STAR JOURNEY

## B17 — Star Journey and Greenlight

**Depends on:** B04, B08, B11, B12

### B17.1 Star Journey

Track meaningful career progression.

### B17.2 First 100

Recognize early attendees/supporters who backed an emerging creator.

### B17.3 Greenlight

Validate demand before a major Experience.

### B17.4 Rising Star evidence

Use attendance, repeat audience, ticket conversion, retention and other signals.

### B17.5 Star-to-Star introductions

Allow established Stars to recommend/discover emerging creators.

### B17.6 Star discovery surfaces

"Before They Were Famous" / Emerging Stars experiences.

### B17.7 Star status taxonomy

Redesign legacy White/Gold/Elite concepts into a coherent status model rather than accumulating overlapping badges.

---

# 15. PHASE 11 — AI SHOWRUNNER AND INTELLIGENCE

## B18 — STARRIA AI Showrunner

**Depends on:** B10, B11, B17

### B18.1 Show planning assistant

Build a schedule/program from creator intent.

### B18.2 Live intelligence

Retention, drop-off, audience questions, interaction spikes, upcoming commercial moments.

### B18.3 Audience question selection

Rank questions under creator-defined rules.

### B18.4 Clip/highlight generation

Create post-event assets from eligible media.

### B18.5 Creator recommendations

Suggest ticket strategy, show length, collaborators and follow-up Experiences using creator-owned analytics.

### B18.6 Translation and accessibility

Subtitles, translations and context where rights/content policy permits.

### B18.7 Inbox intelligence

Message classification and summarization.

**No autonomous impersonation of creators without explicit authorization.**

---

# 16. PHASE 12 — GLOBALIZATION

## B19 — Global entertainment network

**Depends on:** B11, B14, B18

### B19.1 Country/language support

International identity and discovery fields.

### B19.2 Cross-language discovery

Recommend entertainment outside a user's native language.

### B19.3 Subtitles and cultural context

Assist cross-cultural understanding.

### B19.4 International event pricing

Stari remains the user-facing currency while underlying commercial conversion is handled by STARRIA infrastructure.

### B19.5 Global creator onboarding

Established entertainer verification in multiple markets.

---

# 17. PHASE 13 — EXPERIENCE-FIRST UI SYSTEM

## B20 — STARRIA future UI system

**Depends on:** B05, B08, B10, B11

### B20.1 Experience Canvas

Entertainment remains visually dominant.

### B20.2 Live State