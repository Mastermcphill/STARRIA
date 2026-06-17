import { ApiProperty } from '@nestjs/swagger';

export class WalletBalanceResponseDto {
  @ApiProperty() walletId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() coinBalance!: number;
  @ApiProperty() updatedAt!: string;
}

export class WalletTransactionDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() coinAmount!: number | null;
  @ApiProperty() fiatAmount!: number | null;
  @ApiProperty() currency!: string;
  @ApiProperty() description!: string | null;
  @ApiProperty() hash!: string;
  @ApiProperty() createdAt!: string;
}

export class WalletTransactionsResponseDto {
  @ApiProperty({ type: [WalletTransactionDto] }) items!: WalletTransactionDto[];
  @ApiProperty() total!: number;
}
