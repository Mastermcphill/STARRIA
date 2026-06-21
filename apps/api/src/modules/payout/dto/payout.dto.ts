import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RequestWithdrawalDto {
  @ApiProperty({ description: 'Number of coins to withdraw', minimum: 1 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Payout rail. Defaults to paystack. Must be enabled for payouts.',
    enum: ['paystack', 'flutterwave', 'korapay', 'stripe_connect', 'wise', 'trolley', 'tipalti'],
    default: 'paystack',
  })
  @IsOptional()
  @IsIn(['paystack', 'flutterwave', 'korapay', 'stripe_connect', 'wise', 'trolley', 'tipalti'])
  provider?: 'paystack' | 'flutterwave' | 'korapay' | 'stripe_connect' | 'wise' | 'trolley' | 'tipalti';

  @ApiProperty({
    description:
      'Payout destination. Paystack: a recipient_code. Flutterwave/Korapay: "<bankCode>:<accountNumber>". ' +
      'Wise: the recipient account id. ' +
      'Onboarding rails (stripe_connect, trolley, tipalti): ignored — the destination is resolved from your onboarded recipient.',
  })
  @IsString()
  @MinLength(1)
  destination!: string;

  @ApiPropertyOptional({ description: 'Idempotency key — repeat requests with the same key are deduped' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class QuoteWithdrawalDto {
  @ApiProperty({ description: 'Number of coins to withdraw', minimum: 1 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Payout rail (defaults to paystack). Determines the payout currency.',
    enum: ['paystack', 'flutterwave', 'korapay', 'stripe_connect', 'wise', 'trolley', 'tipalti'],
    default: 'paystack',
  })
  @IsOptional()
  @IsIn(['paystack', 'flutterwave', 'korapay', 'stripe_connect', 'wise', 'trolley', 'tipalti'])
  provider?: string;

  @ApiPropertyOptional({ description: 'Override the payout currency (mainly for Wise).' })
  @IsOptional()
  @IsString()
  currency?: string;
}
