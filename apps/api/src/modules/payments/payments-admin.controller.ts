import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { ProviderToggleService } from './provider-toggle.service';
import { PAYMENT_CAPABILITIES, type PaymentCapability } from './provider-catalog';
import { SetProviderToggleDto } from './dto/provider-toggle.dto';

type AuthedReq = { user: { userId: string } };

/**
 * Admin console for the payment-provider registry. Admin-only — @Roles(ADMIN)
 * at the class level, enforced by the global RolesGuard. This is the runtime
 * counterpart to the Render/Railway env flags: changes here take effect
 * immediately (no redeploy) and override the env default.
 */
@ApiTags('admin-payments')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(private readonly toggles: ProviderToggleService) {}

  @Get('providers')
  @ApiOperation({
    summary: 'List every provider/capability with its resolved on/off state',
  })
  @ApiQuery({ name: 'capability', required: false, enum: PAYMENT_CAPABILITIES })
  list(@Query('capability') capability?: PaymentCapability) {
    const cap =
      capability && PAYMENT_CAPABILITIES.includes(capability) ? capability : undefined;
    return this.toggles.listStates(cap);
  }

  @Post('providers/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force a provider on/off for a capability (or clear to use the env default)',
  })
  toggle(@Request() req: AuthedReq, @Body() dto: SetProviderToggleDto) {
    return this.toggles.setOverride(
      dto.provider,
      dto.capability,
      dto.enabled,
      req.user.userId,
      dto.note,
    );
  }
}
