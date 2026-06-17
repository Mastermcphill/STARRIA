import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const GENRES = ['COMEDY','AI_MOVIES','AI_SERIES','MUSIC','ANIMALS','ANIMATION','EDUCATION','LIFESTYLE'] as const;

export class VerticalFeedQueryDto {
  @ApiPropertyOptional({ enum: GENRES, default: 'COMEDY' })
  @IsOptional() @IsIn(GENRES as unknown as string[]) genre: string = 'COMEDY';

  @ApiPropertyOptional({ description: 'ISO country filter' })
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ description: 'ISO language filter' })
  @IsOptional() @IsString() language?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
}

export class LocalFeedQueryDto {
  @ApiPropertyOptional({ description: 'ISO country (else resolved from header)' })
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ enum: GENRES })
  @IsOptional() @IsIn(GENRES as unknown as string[]) genre?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
