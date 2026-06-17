import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({ description: 'User ID (defaults to authenticated user)' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class WalletResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() coinBalance!: number;
  @ApiProperty() createdAt!: string;
}
