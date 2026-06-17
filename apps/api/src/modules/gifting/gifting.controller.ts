import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GiftingService } from './gifting.service';
import { SendCoinGiftDto, CoinGiftResponseDto } from './dto/send-coin-gift.dto';
import { GiftHistoryQueryDto } from './dto/gift-history.dto';

@ApiTags('gifting')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gifting')
export class GiftingController {
  constructor(private readonly giftingService: GiftingService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Get gift catalog (available gift types and coin costs)' })
  getCatalog() {
    return this.giftingService.getCatalog();
  }

  @Post('coin')
  @ApiOperation({ summary: 'Send a coin gift to a creator' })
  @ApiResponse({ status: 201, type: CoinGiftResponseDto })
  async sendCoinGift(
    @Request() req: { user: { userId: string } },
    @Body() dto: SendCoinGiftDto,
  ): Promise<CoinGiftResponseDto> {
    return this.giftingService.sendCoinGift(req.user.userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get coin gift history (filterable by sender/recipient)' })
  getHistory(@Query() query: GiftHistoryQueryDto) {
    return this.giftingService.getGiftHistory(query);
  }
}
