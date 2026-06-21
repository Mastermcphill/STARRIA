import {
  Body, Controller, Get, HttpCode, Param, Post, Query, RawBodyRequest, Req, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PayoutService } from './payout.service';
import { Public } from '../auth/public.decorator';
import { WebhookIpAllowlistGuard, WebhookSource } from '../../common/webhook-ip.guard';
import { RequestWithdrawalDto, QuoteWithdrawalDto } from './dto/payout.dto';

type AuthedReq = { user: { userId: string } };

@ApiTags('payouts')
@ApiBearerAuth()
@Controller('payouts')
export class PayoutController {
  constructor(private readonly svc: PayoutService) {}

  @Post()
  // Money-movement endpoint — far tighter than the global 100/60s default.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a withdrawal (reserves funds and initiates a payout)' })
  request(@Request() req: AuthedReq, @Body() dto: RequestWithdrawalDto) {
    return this.svc.requestWithdrawal(req.user.userId, dto);
  }

  @Post('quote')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Preview a withdrawal conversion (net after fees) without reserving funds' })
  quote(@Request() req: AuthedReq, @Body() dto: QuoteWithdrawalDto) {
    return this.svc.quote(req.user.userId, dto.amount, dto.provider, dto.currency);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's payout requests" })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  list(
    @Request() req: AuthedReq,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listForUser(
      req.user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}

// Provider webhook receiver. Public (no JWT) but HMAC-verified over the raw
// body. Requires rawBody:true on the app (already enabled in main.ts).
@ApiTags('webhooks')
@Controller('webhooks')
export class PayoutWebhookController {
  constructor(private readonly svc: PayoutService) {}

  // One route per payout rail:
  //   POST /webhooks/payout/{paystack|flutterwave|korapay}
  // Each rail signs differently, so we pull the header it uses and hand the raw
  // body + signature to the service, which verifies via the named provider.
  @Public()
  @UseGuards(WebhookIpAllowlistGuard)
  @WebhookSource('PAYOUT_WEBHOOK_IPS')
  @Post('payout/:provider')
  @HttpCode(200)
  @ApiParam({ name: 'provider', enum: ['paystack', 'flutterwave', 'korapay', 'stripe_connect', 'wise', 'trolley', 'tipalti'] })
  @ApiOperation({ summary: 'Payout provider webhook (signature-verified) — reconciles payouts' })
  webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<{ headers: Record<string, string | undefined>; body?: unknown }>,
  ) {
    const raw = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))).toString('utf8');
    return this.svc.handleWebhook(provider, raw, payoutSignature(provider, req.headers));
  }
}

/** Pull the signature header the given payout rail uses. */
function payoutSignature(
  provider: string,
  headers: Record<string, string | undefined>,
): string | undefined {
  switch (provider) {
    case 'flutterwave':
      return headers['verif-hash'];
    case 'korapay':
      return headers['x-korapay-signature'];
    case 'stripe_connect':
      return headers['stripe-signature'];
    case 'wise':
      return headers['x-signature-sha256'];
    case 'trolley':
      return headers['x-pr-signature'] ?? headers['x-paymentrails-signature'];
    case 'tipalti':
      return headers['x-tipalti-signature'];
    default:
      return headers['x-paystack-signature'];
  }
}
