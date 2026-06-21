import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TicketingService } from './ticketing.service';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('events')
export class TicketingController {
  constructor(private readonly ticketingService: TicketingService) {}

  @Post(':id/tickets/purchase')
  @ApiOperation({ summary: 'Purchase a ticket for an event using coins' })
  @ApiResponse({ status: 201, description: 'Ticket purchased successfully' })
  purchaseTicket(
    @Request() req: { user: { userId: string } },
    @Param('id') eventId: string,
    @Body() dto: PurchaseTicketDto,
  ) {
    return this.ticketingService.purchaseTicket(req.user.userId, { ...dto, eventId });
  }

  @Get('/tickets/me')
  @ApiOperation({ summary: "Get the current user's purchased tickets" })
  getMyTickets(@Request() req: { user: { userId: string } }) {
    return this.ticketingService.getMyTickets(req.user.userId);
  }

  @Post(':id/tickets/verify')
  @ApiOperation({ summary: 'Verify ticket ownership for an event' })
  verifyOwnership(
    @Request() req: { user: { userId: string } },
    @Param('id') eventId: string,
  ) {
    return this.ticketingService.verifyOwnership(req.user.userId, eventId);
  }

  @Post(':id/tickets/:purchaseId/refund')
  @ApiOperation({ summary: 'Request a refund for a ticket purchase' })
  refundTicket(
    @Request() req: { user: { userId: string } },
    @Param('purchaseId') purchaseId: string,
    @Body('reason') reason?: string,
  ) {
    return this.ticketingService.refundTicket(req.user.userId, purchaseId, reason);
  }
}
