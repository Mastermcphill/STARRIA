import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { PayoutService } from '../payout/payout.service';
import { WithdrawDto, WithdrawResponseDto } from './dto/withdraw.dto';
import { WalletBalanceResponseDto, WalletTransactionsResponseDto } from './dto/wallet-balance.dto';
import { WalletResponseDto } from './dto/create-wallet.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly payoutService: PayoutService,
  ) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a wallet for the authenticated user' })
  @ApiResponse({ status: 201, type: WalletResponseDto })
  async create(@Request() req: { user: { userId: string } }): Promise<WalletResponseDto> {
    const wallet = await this.walletService.createWallet(req.user.userId);
    return {
      id: wallet.id,
      userId: wallet.userId,
      coinBalance: wallet.coinBalance,
      createdAt: wallet.createdAt.toISOString(),
    };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get coin balance for the authenticated user' })
  @ApiResponse({ status: 200, type: WalletBalanceResponseDto })
  async getBalance(@Request() req: { user: { userId: string } }): Promise<WalletBalanceResponseDto> {
    return this.walletService.getBalance(req.user.userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, type: WalletTransactionsResponseDto })
  async getTransactions(
    @Request() req: { user: { userId: string } },
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    const result = await this.walletService.getTransactions(req.user.userId, +limit, +offset);
    return {
      items: result.items.map(e => ({
        id: e.id,
        type: e.type,
        coinAmount: e.coinAmount,
        fiatAmount: e.fiatAmount,
        currency: e.currency,
        description: e.description,
        hash: e.hash,
        createdAt: e.createdAt.toISOString(),
      })),
      total: result.total,
    };
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Request a withdrawal (reserves coins and initiates a payout)' })
  @ApiResponse({ status: 201, type: WithdrawResponseDto })
  async withdraw(
    @Request() req: { user: { userId: string } },
    @Body() dto: WithdrawDto,
  ): Promise<WithdrawResponseDto> {
    const record = await this.payoutService.requestWithdrawal(req.user.userId, {
      amount: dto.amount,
      currency: dto.currency,
      destination: dto.destination,
    });
    return {
      payoutId: record!.id,
      status: record!.status,
      amount: record!.amountCoins,
      currency: record!.currency,
    };
  }
}
