import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class SendLiveGiftDto {
  @ApiProperty({ description: 'Creator user ID (recipient)' })
  @IsUUID()
  recipientId!: string;

  @ApiProperty({ description: 'Gift type key (e.g. "star", "fire", "crown")' })
  @IsString()
  giftType!: string;

  @ApiProperty({ description: 'Number of coins to send', minimum: 1 })
  @IsInt()
  @IsPositive()
  coins!: number;

  @ApiPropertyOptional({ description: 'Optional message with the gift' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
