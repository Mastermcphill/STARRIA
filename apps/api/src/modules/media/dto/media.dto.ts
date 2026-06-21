import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const PURPOSES = ['avatars', 'images', 'videos'] as const;
export type MediaPurpose = typeof PURPOSES[number];

export class RequestUploadUrlDto {
  @ApiProperty({ enum: PURPOSES, description: 'Determines the storage path prefix' })
  @IsIn(PURPOSES as unknown as string[])
  purpose!: MediaPurpose;

  @ApiProperty({ example: 'clip.mp4' })
  @IsString()
  fileName!: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  contentType!: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024 * 1024) // 5 GB hard cap
  size?: number;
}

export class CompleteUploadDto {
  @ApiProperty()
  @IsUUID()
  uploadId!: string;
}

export class UploadUrlResponseDto {
  @ApiProperty() uploadId!: string;
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() key!: string;
  @ApiProperty() expiresAt!: string;
}

export class MediaResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() url!: string;
  @ApiProperty() contentType!: string;
  @ApiPropertyOptional() size?: number;
  @ApiProperty() purpose!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() completedAt?: Date;
}
