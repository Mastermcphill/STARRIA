import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SendCoinGiftDto {
  @ApiProperty({ description: 'Star (creator) user ID to gift' })
  @IsUUID()
  recipientId!: string;

  @ApiProperty({ description: 'Catalog gift ID (star/rocket/crown/galaxy/supernova) — overrides coins if set' })
  @IsOptional()
  @IsString()
  giftId?: string;

  @ApiProperty({ description: 'Custom coin amount (ignored when giftId is set)', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  coins?: number;

  @ApiPropertyOptional({ description: 'Content ID being gifted on (event, post, profile)' })
  @IsOptional()
  @IsString()
  contentId?: string;

  @ApiPropertyOptional({ example: 'PROFILE' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Idempotency key — supply to deduplicate retries' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CoinGiftResponseDto {
  @ApiProperty() status!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() coins!: number;
  @ApiProperty() platformCut!: number;
  @ApiProperty() creatorAmount!: number;
  @ApiProperty() platformPercentage!: number;
  @ApiProperty() senderBalance!: number;
  @ApiProperty() creatorBalance!: number;
}
