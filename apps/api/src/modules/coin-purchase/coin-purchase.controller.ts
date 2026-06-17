import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CoinPurchaseService } from './coin-purchase.service';
import { PurchaseCoinsDto, CoinPurchaseResponseDto, VerifyCoinPurchaseDto } from './dto/purchase-coins.dto';

@ApiTags('coin-purchase')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('coins')
export class CoinPurchaseController {
  constructor(private readonly coinPurchaseService: CoinPurchaseService) {}

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
