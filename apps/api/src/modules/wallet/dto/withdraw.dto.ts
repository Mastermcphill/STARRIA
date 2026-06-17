import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class WithdrawDto {
  @ApiProperty({ description: 'Amount in minor units (cents)', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Bank account / destination reference' })
  @IsString()
  destination!: string;
}

export class WithdrawResponseDto {
  @ApiProperty() payoutId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
}
