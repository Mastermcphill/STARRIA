import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GiftHistoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() senderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recipientId?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;
}
