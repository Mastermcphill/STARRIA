import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export type BillingCurrency = 'NGN' | 'USD';

// Coin packages — how many coins per fiat purchase. Each package carries a price
// per settlement currency; the buyer is charged in the currency of the chosen
// rail (African rails settle NGN, global rails settle USD — see
// PROVIDER_BILLING_CURRENCY). Minor units: NGN kobo (÷100), USD cents (÷100).
export const COIN_PACKAGES = [
  { id: 'starter',  coins: 100,   prices: { NGN: 50000,   USD: 199 } },
  { id: 'popular',  coins: 500,   prices: { NGN: 200000,  USD: 799 } },
  { id: 'pro',      coins: 1500,  prices: { NGN: 500000,  USD: 1999 } },
  { id: 'elite',    coins: 5000,  prices: { NGN: 1500000, USD: 5999 } },
] as const;

export type CoinPackageId = (typeof COIN_PACKAGES)[number]['id'];

// Which fiat currency each checkout rail settles in. Drives the price selected
// from a package's `prices` map at initiate time. apple_pay/google_pay are
// priced by the store; USD is a sane default for the server-returned amount.
export const PROVIDER_BILLING_CURRENCY: Record<string, BillingCurrency> = {
  paystack: 'NGN',
  flutterwave: 'NGN',
  korapay: 'NGN',
  stripe: 'USD',
  tazapay: 'USD',
  lemonsqueezy: 'USD',
  paddle: 'USD',
  apple_pay: 'USD',
  google_pay: 'USD',
};

/** The settlement currency for a provider (defaults to USD if unknown). */
export function billingCurrencyFor(provider: string): BillingCurrency {
  return PROVIDER_BILLING_CURRENCY[provider] ?? 'USD';
}

export class PurchaseCoinsDto {
  @ApiProperty({ enum: ['starter', 'popular', 'pro', 'elite'] })
  @IsIn(['starter', 'popular', 'pro', 'elite'])
  packageId!: CoinPackageId;

  @ApiProperty({
    enum: [
      'paystack', 'stripe', 'flutterwave', 'korapay',
      'tazapay', 'lemonsqueezy', 'paddle', 'apple_pay', 'google_pay',
    ],
  })
  @IsIn([
    'paystack', 'stripe', 'flutterwave', 'korapay',
    'tazapay', 'lemonsqueezy', 'paddle', 'apple_pay', 'google_pay',
  ])
  provider!:
    | 'paystack' | 'stripe' | 'flutterwave' | 'korapay'
    | 'tazapay' | 'lemonsqueezy' | 'paddle' | 'apple_pay' | 'google_pay';

  @ApiPropertyOptional({ description: 'Idempotency key for retries' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CoinPurchaseResponseDto {
  @ApiProperty() reference!: string;
  @ApiProperty() providerReference!: string;
  @ApiProperty() coins!: number;
  @ApiProperty() priceMinorUnits!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() authorizationUrl?: string;
}

export class VerifyCoinPurchaseDto {
  @ApiProperty() reference!: string;
  @IsString() @ApiProperty() provider!: string;
}
