import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Plan key (SubscriptionPlan.key), e.g. "premium_monthly"' })
  @IsString()
  @MinLength(1)
  planKey!: string;

  @ApiPropertyOptional({ description: 'Billing email; defaults to a derived address' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
