import {
  Body, Controller, Get, HttpCode, Param, Post, RawBodyRequest, Req, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CoinPurchaseService } from './coin-purchase.service';
import { Public } from '../auth/public.decorator';
import { PurchaseCoinsDto, CoinPurchaseResponseDto, VerifyCoinPurchaseDto } from './dto/purchase-coins.dto';

@ApiTags('coin-purchase')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('coins')
export class CoinPurchaseController {
  constructor(private readonly coinPurchaseService: CoinPurchaseService) {}

  // Provider server-to-server callback. Unauthenticated (no JWT) but verified
  // by each provider's own signature scheme over the raw body. Requires
  // rawBody:true on the app. One route serves every checkout provider:
  //   POST /coins/webhook/{paystack|stripe|flutterwave|korapay}
  @Public()
  @Post('webhook/:provider')
  @HttpCode(200)
  @ApiParam({
    name: 'provider',
    enum: ['paystack', 'stripe', 'flutterwave', 'korapay', 'tazapay', 'lemonsqueezy', 'paddle'],
  })
  @ApiOperation({ summary: 'Checkout provider webhook (signature-verified) — credits coins on success' })
  async webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<{ headers: Record<string, string | undefined>; body?: unknown }>,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.coinPurchaseService.handleWebhook(provider, raw, req.headers);
  }

  @Get('packages')
  @ApiOperation({ summary: 'Get available coin packages' })
  getPackages() {
    return this.coinPurchaseService.getPackages();
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Initiate a coin purchase (returns provider payment URL)' })
  @ApiResponse({ status: 201, type: CoinPurchaseResponseDto })
  async initiatePurchase(
    @Request() req: { user: { userId: string } },
    @Body() dto: PurchaseCoinsDto,
  ): Promise<CoinPurchaseResponseDto> {
    return this.coinPurchaseService.initiatePurchase(req.user.userId, dto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify a completed payment and credit coins to wallet' })
  async verifyCoinPurchase(
    @Request() req: { user: { userId: string } },
    @Body() dto: VerifyCoinPurchaseDto,
  ) {
    return this.coinPurchaseService.verifyAndCredit(req.user.userId, dto);
  }
}
