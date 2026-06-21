import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

const ONBOARDING_PROVIDERS = ['stripe_connect', 'wise', 'trolley', 'tipalti'] as const;
export type OnboardingProvider = (typeof ONBOARDING_PROVIDERS)[number];

export class StartOnboardingDto {
  @ApiProperty({
    description: 'Payout rail requiring onboarding.',
    enum: ONBOARDING_PROVIDERS,
  })
  @IsIn(ONBOARDING_PROVIDERS as unknown as string[])
  provider!: OnboardingProvider;

  @ApiPropertyOptional({ description: 'Payee email (some rails seed the hosted flow with it)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'ISO-3166 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
