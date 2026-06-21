import {
  Body, Controller, Get, HttpCode, Param, Post, RawBodyRequest, Req, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionsService } from './subscriptions.service';
import { Public } from '../auth/public.decorator';
import { WebhookIpAllowlistGuard, WebhookSource } from '../../common/webhook-ip.guard';
import { CreateSubscriptionDto } from './dto/subscription.dto';

type AuthedReq = { user: { userId: string } };

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  plans() {
    return this.svc.listPlans();
  }

  @Get()
  @ApiOperation({ summary: "List the caller's subscriptions" })
  mine(@Request() req: AuthedReq) {
    return this.svc.listForUser(req.user.userId);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start a subscription (returns the hosted checkout URL)' })
  create(@Request() req: AuthedReq, @Body() dto: CreateSubscriptionDto) {
    return this.svc.createSubscription(req.user.userId, dto.planKey, dto.email);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a subscription (at period end where supported)' })
  cancel(@Request() req: AuthedReq, @Param('id') id: string) {
    return this.svc.cancel(req.user.userId, id);
  }
}

// Provider webhooks. Public (no JWT) but each rail's signature is verified over
// the raw body. One route per rail: POST /webhooks/subscription/{provider}.
@ApiTags('webhooks')
@Controller('webhooks')
export class SubscriptionWebhookController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Public()
  @UseGuards(WebhookIpAllowlistGuard)
  @WebhookSource('SUBSCRIPTION_WEBHOOK_IPS')
  @Post('subscription/:provider')
  @HttpCode(200)
  @ApiParam({ name: 'provider', enum: ['stripe', 'lemonsqueezy', 'paddle'] })
  @ApiOperation({ summary: 'Subscription provider webhook (signature-verified) — reconciles status' })
  webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<{ headers: Record<string, string | undefined>; body?: unknown }>,
  ) {
    const raw = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))).toString('utf8');
    return this.svc.handleWebhook(provider, raw, req.headers);
  }
}
