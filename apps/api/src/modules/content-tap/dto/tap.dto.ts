import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ContentTapDto {
  @ApiProperty({ description: 'Video to tap' })
  @IsString()
  videoId!: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 (else resolved from x-country header)' })
  @IsOptional() @IsString()
  country?: string;
}
