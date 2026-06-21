import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PAYMENT_CAPABILITIES, type PaymentCapability } from '../provider-catalog';

export class SetProviderToggleDto {
  @ApiProperty({ example: 'stripe', description: 'Provider key (lowercase)' })
  @IsString()
  provider!: string;

  @ApiProperty({ enum: PAYMENT_CAPABILITIES })
  @IsIn(PAYMENT_CAPABILITIES as unknown as string[])
  capability!: PaymentCapability;

  @ApiProperty({
    nullable: true,
    description: 'true = force on, false = force off, null = clear override (use env default)',
  })
  @IsOptional()
  @IsBoolean()
  enabled!: boolean | null;

  @ApiPropertyOptional({ description: 'Audit note for the change' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
