# Onboarding-Heavy Payout Rails — Design

**Status:** Draft for review · **Date:** 2026-06-21 · **Owner:** Payments
**Scope:** Add **Stripe Connect**, **Wise**, **Trolley**, **Tipalti** as payout rails.

> These four are deliberately *not* implemented like Paystack/Flutterwave/Korapay.
> Those rails take raw bank details at transfer time and push money in one call.
> The four below require a **persistent, pre-onboarded payee entity** (often
> KYC/tax-verified) before any money can move. This doc defines the model,
> interfaces, flows, and schema to support that, fitting the existing payout
> pipeline in `apps/api/src/modules/payout/`.

---

## 1. Why these rails are different

The current `PayoutProviderPort.transfer({ reference, amountMinorUnits, currency, destination })`
([payout-provider.port.ts](../../apps/api/src/modules/payout/ports/payout-provider.port.ts))
assumes `destination` is a ready-to-use handle and that a transfer is a single
accepted/rejected call. That holds for the African rails. It breaks here:

| Rail | Payee entity | Onboarding | Transfer shape | KYC/Tax owner |
|------|-------------|------------|----------------|---------------|
| **Stripe Connect** | Connected Account (`acct_…`) | Hosted **Account Link** (redirect); status via `account.updated` | `POST /v1/transfers` to the account, then Stripe pays it out | Stripe (per connected acct) |
| **Wise** | Recipient Account (`recipientId`) | API-created from bank fields; profile may need verification | **quote → recipient → transfer → fund** (4 calls) | Us (Wise business profile) |
| **Trolley** | Recipient (`R-…`) | Hosted **widget/iframe** (recipient self-enters bank + tax) | `POST /v1/recipients/:id/payments` (often batched) | Trolley (W-8/W-9 collection) |
| **Tipalti** | Payee (`payeeId`) | Hosted **iFrame suite** (Setup/Tax/Payment) | Submit payment to payee; settles on Tipalti's cycle | Tipalti (full AP/tax) |

**Common shape:** a *recipient* must exist and reach a `payable` state **before**
`requestWithdrawal` can reserve funds against it. Onboarding is asynchronous and
provider-driven (redirect or iframe + webhook), so it cannot live inside the
transfer call.

---

## 2. Unifying model: `PayoutRecipient`

Introduce a per-user, per-provider recipient record. A withdrawal's `destination`
for these rails becomes a **`PayoutRecipient.id`**, not raw bank details — the
provider resolves it to the live handle at transfer time.

```prisma
model PayoutRecipient {
  id                String   @id @default(uuid())
  userId            String
  provider          String   // stripe_connect | wise | trolley | tipalti
  // Provider-side handle: acct_… | wise recipientId | R-… | payeeId.
  providerRef       String?
  // onboarding lifecycle (see §3)
  status            String   @default("pending") // pending | onboarding | active | restricted | rejected | disabled
  // Capability gate: only `active` recipients can receive a transfer.
  payable           Boolean  @default(false)
  // Free-form provider snapshot (requirements due, disabled_reason, country…).
  details           Json?
  // Default destination currency for this recipient, when fixed by onboarding.
  currency          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([userId, provider])           // one recipient per rail per user
  @@unique([provider, providerRef])      // a provider handle maps to one row
  @@index([userId, status])
}
```

`PayoutRequest` already has a `provider` column and a `destination` string. No
schema change needed there — for onboarded rails `destination = PayoutRecipient.id`
(documented in the DTO). Optionally add `recipientId String?` + FK for cleaner
joins; not required for v1.

A second table captures onboarding webhook deliveries for replay protection,
mirroring `PayoutWebhook`:

```prisma
model RecipientOnboardingWebhook {
  id          String   @id @default(uuid())
  provider    String
  event       String
  dedupeKey   String   @unique
  providerRef String?
  rawPayload  Json
  processedAt DateTime @default(now())

  @@index([providerRef])
}
```

---

## 3. Recipient lifecycle (state machine)

```
pending ──createOnboardingLink──▶ onboarding ──webhook/poll──▶ active (payable=true)
                                      │                           │
                                      ├── requirements missing ──▶ restricted (payable=false)
                                      └── rejected/closed ───────▶ rejected | disabled
```

- **pending** — row created, no provider entity yet.
- **onboarding** — provider entity created; user redirected to hosted link / iframe.
- **active** — provider reports the payee can receive funds (`payable=true`). This
  is the *only* state `requestWithdrawal` accepts.
- **restricted** — was active or onboarding but provider now needs more info
  (e.g. Stripe `requirements.currently_due`, Tipalti payment-block). Funds must
  **not** be reserved.
- **rejected / disabled** — terminal; surface to the user, block payouts.

The mapping from each provider's status vocabulary into these five states lives
in the provider adapter (same pattern as the subscription `mapXStatus` helpers).

---

## 4. Interface extensions

Add an **optional** onboarding port. Rails that need it implement both ports;
the existing African rails implement only `PayoutProviderPort` and are untouched.

```ts
// payout/ports/recipient-onboarding.port.ts
export interface OnboardingLinkInput {
  userId: string;
  recipientId: string;          // our PayoutRecipient.id (echoed back / used as metadata)
  returnUrl: string;
  refreshUrl?: string;          // Stripe Account Links need a refresh URL
  email?: string;
  country?: string;
}
export interface OnboardingLinkResult {
  providerRef: string;          // created acct_/payee/recipient id
  // For redirect rails (Stripe/Trolley-hosted/Tipalti): the URL to open.
  // Wise has no hosted flow — returns { providerRef, ready } and no url.
  url?: string;
  ready?: boolean;              // true if payable immediately (rare)
}
export interface RecipientStatus {
  providerRef: string;
  status: 'pending' | 'onboarding' | 'active' | 'restricted' | 'rejected' | 'disabled';
  payable: boolean;
  details?: Record<string, unknown>;
}

export interface RecipientOnboardingPort {
  readonly name: string;
  /** Create/find the provider payee entity and (if hosted) an onboarding URL. */
  createOnboardingLink(input: OnboardingLinkInput): Promise<OnboardingLinkResult>;
  /** Pull current status (used for return-from-redirect and reconciliation). */
  getRecipientStatus(providerRef: string): Promise<RecipientStatus>;
  /** Verify + parse an onboarding webhook (account.updated, recipient.*). */
  verifyOnboardingWebhook(rawBody: Buffer | string, headers: Record<string, string | undefined>): boolean;
  parseOnboardingWebhook(rawBody: Buffer | string): {
    event: string; dedupeKey: string; providerRef?: string; status: RecipientStatus['status']; payable: boolean;
  } | null;
}
```

`PayoutTransferInput.destination` keeps its type but, for these rails, the
adapter treats it as a recipient handle it resolves itself (the service passes
`PayoutRecipient.providerRef`, see §5). **Wise** needs the destination currency +
amount to build a quote — already available on the input.

### Type registry

A small `RecipientOnboardingRegistry` (mirroring `PayoutProviderRegistry`,
built via `useFactory` in `payout.module.ts`) keyed by provider name. Providers
that don't onboard simply aren't registered there.

---

## 5. Service & API changes

### New onboarding endpoints (`PayoutController` or a new `RecipientsController`)

```
POST   /payouts/recipients                 { provider } → { recipientId, url? , status }
GET    /payouts/recipients                  → caller's recipients + status
GET    /payouts/recipients/:id              → one recipient (triggers a getRecipientStatus refresh)
POST   /webhooks/payout-onboarding/:provider  (Public, IP-allowlisted, signature-verified)
```

`POST /payouts/recipients` flow:
1. Upsert `PayoutRecipient(userId, provider, status=pending)`.
2. Call `createOnboardingLink({ recipientId, returnUrl, … })`.
3. Persist `providerRef`, set `status=onboarding`, return the hosted `url`
   (or `ready` for Wise).

### `requestWithdrawal` gating (the critical change)

In `PayoutService.requestWithdrawal`, **before reserving funds**, when the chosen
rail is an onboarding rail (`onboardingRegistry.has(provider)`):

1. Resolve `recipient = PayoutRecipient.findUnique({ userId, provider })`.
2. Reject if missing, or `payable !== true`, with a clear error
   (`recipient_not_onboarded` / `recipient_restricted`). **No reservation occurs.**
3. Set `destination = recipient.providerRef` for the downstream `transfer()`.

This preserves the existing reserve→transfer→webhook→finalize money path verbatim;
the only new precondition is "recipient must be `active`."

### Wise's multi-step transfer

`WisePayoutProvider.transfer()` encapsulates the 4-step dance behind the single
`transfer()` contract, returning `{ accepted, providerRef, status:'processing' }`:

```
1. POST /v3/profiles/{profile}/quotes      (amount, source/target currency)
2. POST /v1/transfers                       (quote + recipientId + customerTransactionId=reference)
3. POST /v3/profiles/{profile}/transfers/{id}/payments  (fund from balance)
4. return providerRef = transferId
```

Settlement confirmation arrives via Wise's transfer-state webhook → existing
`handleWebhook` finalize path (`outcome: success|failed`). Idempotency: pass our
`PayoutRequest.id` as `customerTransactionId` so retries don't double-fund.

### Stripe Connect transfer

`transfer()` = `POST /v1/transfers { amount, currency, destination: acct_…,
transfer_group: reference }`. Money lands in the connected account's Stripe
balance; Stripe handles the bank payout per the account's schedule. We treat the
`transfer.created`/`paid` (or `payout.paid` on the connected account) webhook as
settlement. Reversals (`transfer.reversed`) map to `outcome:'failed'` → release.

### Trolley / Tipalti

Both batch payments on their side. `transfer()` submits a single payment to the
payee and returns the provider payment id; settlement/return webhooks
(`payment.processed` / `payment.failed`, Tipalti `payee_payment_*`) drive
finalize/release. Tax-withholding may reduce the net — record gross (our coins)
and let the webhook carry the provider's settled amount in `details` for audit.

---

## 6. Webhooks

Two distinct webhook concerns, both `@Public` + `WebhookIpAllowlistGuard`:

1. **Payment settlement** → existing `POST /webhooks/payout/:provider`,
   `PayoutService.handleWebhook`. New rails implement `verifyWebhookSignature` +
   `parseWebhook` returning `{ reference = PayoutRequest.id, outcome, dedupeKey }`.
   - Stripe Connect signature = `verifyStripeSignature` (already in
     [webhook-crypto.util.ts](../../apps/api/src/modules/coin-purchase/providers/webhook-crypto.util.ts)).
   - Wise = public-key (RSA-SHA256) signature in `X-Signature-SHA256` — **new
     helper needed** (verifyRsaSignature), not HMAC.
   - Trolley = HMAC-SHA256; Tipalti = HMAC or IPN secret.
2. **Recipient onboarding** → new `POST /webhooks/payout-onboarding/:provider`
   → updates `PayoutRecipient.status`/`payable`, replay-protected by
   `RecipientOnboardingWebhook.dedupeKey`. Stripe `account.updated` is the
   canonical signal here (read `charges_enabled`/`payouts_enabled`/`requirements`).

New env allowlist: `PAYOUT_ONBOARDING_WEBHOOK_IPS` (mirrors `PAYOUT_WEBHOOK_IPS`).

---

## 7. Catalog & toggles

`provider-catalog.ts` gains four payout-capable entries:

```ts
{ key: 'stripe_connect', label: 'Stripe Connect', capabilities: { payout: { credentialEnv: 'STRIPE_SECRET_KEY' } } }
{ key: 'wise',           label: 'Wise',           capabilities: { payout: { credentialEnv: 'WISE_API_TOKEN' } } }
{ key: 'trolley',        label: 'Trolley',        capabilities: { payout: { credentialEnv: 'TROLLEY_SECRET_KEY' } } }
{ key: 'tipalti',        label: 'Tipalti',        capabilities: { payout: { credentialEnv: 'TIPALTI_API_KEY' } } }
```

(`stripe` already exists for checkout/subscription; Connect is a *distinct* rail
key so it can be toggled independently and so its `destination` semantics differ.)
Toggle precedence is unchanged: DB override → `PAYMENTS_<PROVIDER>_PAYOUT_ENABLED`
→ credentials present. All adapters **fail closed** when unconfigured.

New env (documented in `.env.example`):
```
WISE_API_TOKEN= ; WISE_PROFILE_ID= ; WISE_WEBHOOK_PUBLIC_KEY=
STRIPE_CONNECT_CLIENT_ID=   # if using OAuth; Account Links need only STRIPE_SECRET_KEY
TROLLEY_ACCESS_KEY= ; TROLLEY_SECRET_KEY= ; TROLLEY_WEBHOOK_SECRET= ; TROLLEY_WIDGET_BASE=
TIPALTI_PAYER_NAME= ; TIPALTI_API_KEY= ; TIPALTI_MASTER_KEY= ; TIPALTI_IFRAME_BASE=
PAYOUT_ONBOARDING_WEBHOOK_IPS=
```

---

## 8. Security & compliance

- **Money never moves to a non-`active` recipient.** Reservation is gated on
  `payable=true`; this is the hard invariant.
- **KYC/tax** is delegated to the rail (Connect/Trolley/Tipalti collect W-8/W-9
  and run KYC; Wise uses our business profile + recipient verification). We store
  *no* bank numbers for these rails — only the provider handle.
- **Webhook auth**: signature **and** IP allowlist, same as today. Wise requires
  RSA public-key verification (new), not HMAC — do not fall back to "accept if no
  secret."
- **Idempotency**: our `PayoutRequest.id` is the cross-provider idempotency token
  (`transfer_group` / `customerTransactionId` / external id). Settlement webhooks
  dedupe on `dedupeKey`; finalize/release are status-guarded (at-most-once),
  unchanged.
- **Least privilege**: Connect uses `transfers` capability only; no platform-wide
  payout authority beyond connected accounts.

---

## 9. Rollout plan

Each rail is an independent, reviewable increment behind its toggle (default off):

1. **Schema + ports** — `PayoutRecipient`, `RecipientOnboardingWebhook` models +
   migration; `RecipientOnboardingPort` + registry; service gating + onboarding
   endpoints; `verifyRsaSignature` helper. *(No rail yet — pure framework.)*
2. **Stripe Connect** — best reference (hosted Account Link, clean
   `account.updated`, reuses Stripe signature). Unit-test signature + status mapping.
3. **Wise** — adds the quote→fund multi-step transfer + RSA webhook.
4. **Trolley** — hosted widget + batch payment + HMAC webhook.
5. **Tipalti** — iFrame suite + payee payment webhook (heaviest integration).

Per existing practice: adapters are written to spec and fail-closed; the
*verified* parts in CI are the signature/parse/status-mapping logic. End-to-end
validation needs each provider's sandbox (a real onboarding + a sandbox payout
hitting both webhook routes).

---

## 10. Decisions needed before build

1. **One recipient per (user, provider), or many?** Design assumes one
   (`@@unique([userId, provider])`). Multiple bank destinations per user would
   need a different key and a `destination` selector on withdrawal.
2. **Default global payout rail.** Today it's `paystack` (NGN). Do non-NGN
   creators get a default (e.g. Wise), or must they explicitly onboard a rail
   first? Recommend: **no default for onboarding rails** — withdrawal requires an
   `active` recipient, surfaced in the UI.
3. **Who bears FX + fees?** Wise/Connect cross-currency payouts incur FX + fees.
   Define whether the creator's coin→fiat rate absorbs this or it's deducted from
   the payout (affects the `amountMinorUnits` we send vs. coins reserved).
4. **Coin→fiat conversion** for these rails (currently the payout amount is
   coins-as-minor-units to NGN). Multi-currency payout needs the same
   per-currency pricing treatment as the [coin packages](../../apps/api/src/modules/coin-purchase/dto/purchase-coins.dto.ts).
5. **Tax reporting surface.** Trolley/Tipalti generate 1099/1042-S. Confirm we
   only *consume* their tax handling and don't need to store tax docs ourselves.

> Items 3–4 (FX/conversion) are the only ones that touch the core money math and
> should be resolved before rail #2 (Wise). Connect (#1) can ship same-currency
> first.
