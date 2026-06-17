# lib/features/marketplace

## Purpose

Complete Flutter feature slice for HAILO's subscription marketplace — the system through which fleet owners purchase ride seats/plans for their drivers. Covers data layer, state management, domain models, and a full set of UI screens.

**What the marketplace does:**
- Displays available subscription offers (`OffersScreen`)
- Enforces a paywall for unpaid/expired plans (`PaywallScreen`)
- Manages seat allocation across an org (`SeatsScreen`, `ManageSeatsScreen`)
- Handles purchase checkout, payment intent creation, and receipt display
- Shows a billing invoice history and a full purchase timeline
- Supports multi-org switching and team invites

| Subdirectory | Contents |
|-------------|----------|
| `data/` | `MarketplaceRepository` (abstract), `MarketplaceRepositoryHttp` (live), `MarketplaceRepositoryMock` (dev), `MarketplaceLocalStore` (SharedPreferences), `MarketplaceEndpoints`, `MarketplaceMappers` |
| `models/` | `Offer`, `OrgSummary`, `BillingInvoice`, `PaymentIntent`, `PurchaseReceipt`, `PurchaseSnapshot`, `SeatSelection`, `TimelineEvent`, `PaywallCopy`, `PricingBreakdown`, `OutboxItem` |
| `state/` | `MarketplaceController` (ChangeNotifier) — full checkout flow state, outbox queue, org switching |
| `ui/` | `OffersScreen`, `PaywallScreen`, `BillingScreen`, `SeatsScreen`, `ManageSeatsScreen`, `InviteScreen`, `ReceiptScreen`, `TimelineScreen`, `PlanChangePreviewScreen`, `TeamSelector` |
| Root | `marketplace_module.dart` — wires repository + controller |

## Reusable Files

**Models (extract verbatim):**
- `models/offer.dart` — `Offer` with `fromMap`/`toMap`, priceMinor/currency/seats/perks
- `models/pricing_breakdown.dart` — pricing calculation output
- `models/purchase_receipt.dart` / `purchase_snapshot.dart` — post-purchase records
- `models/timeline_event.dart` — purchase lifecycle events
- `models/payment_intent.dart` — payment session token + metadata
- `models/billing_invoice.dart` — billing history entries
- `models/seat_selection.dart` — seat count + org context

**Data layer (extract with endpoint swap):**
- `data/marketplace_repository.dart` — abstract repository interface
- `data/marketplace_repository_http.dart` — HTTP implementation (swap endpoint paths)
- `data/marketplace_repository_mock.dart` — mock for dev/test
- `data/marketplace_mappers.dart` — JSON ↔ model mapping functions
- `data/marketplace_local_store.dart` — SharedPreferences persistence of active org

**State (extract with modifications):**
- `state/marketplace_controller.dart` — checkout flow, outbox queue for offline resilience, error/info banner state, coupon/referral draft inputs

**Screens (use as reference, recreate with STARRIA branding):**
- `ui/paywall_screen.dart` — gate pattern
- `ui/offers_screen.dart` — plan comparison
- `ui/receipt_screen.dart` — post-purchase confirmation

## STARRIA Use Case

STARRIA's fleet subscription model (fleet owners paying for driver seats/plans) is architecturally identical to HAILO's marketplace. This entire feature can be extracted as STARRIA's subscription module.

Key adaptations needed:
1. **Endpoint paths**: update `MarketplaceEndpoints` with STARRIA API paths.
2. **Offer model**: `vehicleClass` field is HAILO-specific — rename or repurpose for STARRIA plan tiers.
3. **Currency**: already parameterised (`currency` field on `Offer`) — set STARRIA default.
4. **Org RBAC**: `org_rbac.dart` in the backend maps to STARRIA's fleet-owner permission model.
5. **Outbox queue**: `OutboxItem` + pending outbox count in `MarketplaceController` provides offline purchase resilience — valuable in low-connectivity markets.

The paywall pattern (`PaywallScreen` → `OffersScreen` → checkout → `ReceiptScreen`) is a proven conversion funnel for subscription products. Preserve the UX flow.

## Extraction Difficulty

**Medium.** Clean internal architecture (repository pattern, ChangeNotifier controller, screen-per-route). Dependencies are: `ApiClient` from `lib/core`, `SharedPreferences`, `go_router`, `provider`. No native channels. The mock repository makes the feature testable in isolation.

Main effort: rebrand UI screens (30–40% of work) and update endpoint paths + offer field names.

## Candidate Package

`starria_marketplace` — Flutter feature package. Self-contained module with its own repository, controller, models, and screens. Other features depend on `MarketplaceController` for entitlement checks (paywall gating).
