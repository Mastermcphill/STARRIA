import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiPropertyOptional({ description: 'Reason for suspension (recorded in the audit log)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class UnsuspendUserDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  @MinLength(1)
  userId!: string;
}
