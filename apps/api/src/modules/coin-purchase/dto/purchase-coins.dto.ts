import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

// Coin packages — how many coins per fiat purchase
export const COIN_PACKAGES = [
  { id: 'starter',  coins: 100,   priceMinorUnits: 50000,  currency: 'NGN' },
  { id: 'popular',  coins: 500,   priceMinorUnits: 200000, currency: 'NGN' },
  { id: 'pro',      coins: 1500,  priceMinorUnits: 500000, currency: 'NGN' },
  { id: 'elite',    coins: 5000,  priceMinorUnits: 1500000,currency: 'NGN' },
] as const;

export type CoinPackageId = (typeof COIN_PACKAGES)[number]['id'];

export class PurchaseCoinsDto {
  @ApiProperty({ enum: ['starter', 'popular', 'pro', 'elite'] })
  @IsIn(['starter', 'popular', 'pro', 'elite'])
  packageId!: CoinPackageId;

  @ApiProperty({ enum: ['paystack', 'apple_pay', 'google_pay'] })
  @IsIn(['paystack', 'apple_pay', 'google_pay'])
  provider!: 'paystack' | 'apple_pay' | 'google_pay';

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
