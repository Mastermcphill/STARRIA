import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartWatchDto {
  @ApiProperty() @IsString() videoId!: string;
  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 (else resolved from header)' })
  @IsOptional() @IsString() country?: string;
}

export class CompleteWatchDto {
  @ApiProperty() @IsString() watchId!: string;
  @ApiProperty({ description: 'Seconds actually watched' }) @IsInt() @Min(0) watchSeconds!: number;
  @ApiProperty({ description: 'Total video duration in seconds' }) @IsInt() @Min(1) durationSeconds!: number;
}
