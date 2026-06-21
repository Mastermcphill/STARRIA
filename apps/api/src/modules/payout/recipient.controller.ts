import {
  Body, Controller, Get, HttpCode, Param, Post, RawBodyRequest, Req, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RecipientService } from './recipient.service';
import { Public } from '../auth/public.decorator';
import { WebhookIpAllowlistGuard, WebhookSource } from '../../common/webhook-ip.guard';
import { StartOnboardingDto } from './dto/recipient.dto';

type AuthedReq = { user: { userId: string } };

@ApiTags('payouts')
@ApiBearerAuth()
@Controller('payouts/recipients')
export class RecipientController {
  constructor(private readonly svc: RecipientService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start (or resume) payee onboarding for a rail — returns the hosted onboarding URL' })
  start(@Request() req: AuthedReq, @Body() dto: StartOnboardingDto) {
    return this.svc.startOnboarding(req.user.userId, dto.provider, dto.email, dto.country);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's payout recipients and their onboarding status" })
  list(@Request() req: AuthedReq) {
    return this.svc.listForUser(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one recipient, refreshing its status from the provider' })
  get(@Request() req: AuthedReq, @Param('id') id: string) {
    return this.svc.getAndRefresh(req.user.userId, id);
  }
}

// Recipient-onboarding webhooks (e.g. Stripe account.updated). Distinct from
// payment-settlement webhooks (POST /webhooks/payout/:provider). Public but
// signature-verified over the raw body + IP-allowlisted.
@ApiTags('webhooks')
@Controller('webhooks')
export class RecipientOnboardingWebhookController {
  constructor(private readonly svc: RecipientService) {}

  @Public()
  @UseGuards(WebhookIpAllowlistGuard)
  @WebhookSource('PAYOUT_ONBOARDING_WEBHOOK_IPS')
  @Post('payout-onboarding/:provider')
  @HttpCode(200)
  @ApiParam({ name: 'provider', enum: ['stripe_connect', 'wise', 'trolley', 'tipalti'] })
  @ApiOperation({ summary: 'Recipient onboarding webhook (signature-verified) — updates payee status' })
  webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<{ headers: Record<string, string | undefined>; body?: unknown }>,
  ) {
    const raw = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))).toString('utf8');
    return this.svc.handleOnboardingWebhook(provider, raw, req.headers);
  }
}
