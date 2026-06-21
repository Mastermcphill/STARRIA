import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export class ReportDto {
  @ApiProperty({ description: 'ID of the reported entity' })
  @IsString()
  @MinLength(1)
  targetId!: string;

  @ApiProperty({ description: "Kind of entity, e.g. 'user' | 'event' | 'arena' | 'tap' | 'message'" })
  @IsString()
  @MinLength(1)
  targetType!: string;

  @ApiProperty({ description: 'Why the entity is being reported' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({ description: 'Moderation case category' })
  @IsOptional()
  @IsString()
  caseType?: string;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES as unknown as string[])
  severity?: (typeof SEVERITIES)[number];
}

export class BlockDto {
  @ApiProperty({ description: 'User ID to block' })
  @IsString()
  @MinLength(1)
  blockedId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class UnblockDto {
  @ApiProperty({ description: 'User ID to unblock' })
  @IsString()
  @MinLength(1)
  blockedId!: string;
}

export class TakedownDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  targetId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  targetType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  outcome!: 'approved' | 'rejected';
}

export class ScanContentDto {
  @ApiProperty({ description: 'ID of the entity whose content is being scanned' })
  @IsString()
  @MinLength(1)
  targetId!: string;

  @ApiProperty({ description: "Kind of entity, e.g. 'post' | 'message' | 'profile' | 'replay'" })
  @IsString()
  @MinLength(1)
  targetType!: string;

  @ApiProperty({ enum: ['TEXT', 'IMAGE'] })
  @IsIn(['TEXT', 'IMAGE'])
  kind!: 'TEXT' | 'IMAGE';

  @ApiPropertyOptional({ description: 'Text to scan (required when kind=TEXT)' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  @ApiPropertyOptional({ description: 'Image URL to scan (required when kind=IMAGE)' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;
}
