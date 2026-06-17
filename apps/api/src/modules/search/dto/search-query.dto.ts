import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Free text — matches title and tags' })
  @IsOptional() @IsString() q?: string;

  @ApiPropertyOptional({ description: 'Creator star profile ID' })
  @IsOptional() @IsString() creatorId?: string;

  @ApiPropertyOptional({ description: 'Creator @handle (username)' })
  @IsOptional() @IsString() creatorHandle?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country' })
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ description: 'ISO 639-1 language' })
  @IsOptional() @IsString() language?: string;

  @ApiPropertyOptional({ enum: ['COMEDY','AI_MOVIES','AI_SERIES','MUSIC','ANIMALS','ANIMATION','EDUCATION','LIFESTYLE'] })
  @IsOptional() @IsString() genre?: string;

  @ApiPropertyOptional({ enum: ['relevance', 'recent', 'score'] })
  @IsOptional() @IsIn(['relevance', 'recent', 'score']) sort?: 'relevance' | 'recent' | 'score';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
