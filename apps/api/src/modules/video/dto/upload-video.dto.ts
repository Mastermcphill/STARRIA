import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const GENRES = ['COMEDY','AI_MOVIES','AI_SERIES','MUSIC','ANIMALS','ANIMATION','EDUCATION','LIFESTYLE'] as const;

export class UploadVideoDto {
  @ApiProperty() @IsString() @MaxLength(140) title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiProperty({ enum: GENRES })
  @IsIn(GENRES as unknown as string[])
  genre!: typeof GENRES[number];

  @ApiProperty({ description: 'Object storage key of the already-uploaded media' })
  @IsString()
  storageKey!: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2' })
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ description: 'ISO 639-1' })
  @IsOptional() @IsString() language?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class VideoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() title!: string;
  @ApiProperty() genre!: string;
  @ApiPropertyOptional() playbackUrl?: string;
  @ApiPropertyOptional() thumbnailUrl?: string;
}
