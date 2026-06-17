import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSupporterProfileDto {
  @ApiProperty() @IsString() displayName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
}

export class UpdateSupporterProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
}

export class SubscribeDto {
  @ApiProperty() @IsUUID() starId!: string;
  @ApiProperty({ enum: ['basic', 'premium', 'vip'] }) tier!: 'basic' | 'premium' | 'vip';
  @ApiPropertyOptional() @IsOptional() @IsString() idempotencyKey?: string;
}

export class CancelSubscriptionDto {
  @ApiProperty() @IsUUID() subscriptionId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() immediate?: boolean;
}
