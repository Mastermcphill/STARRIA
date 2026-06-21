import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class PurchaseTicketDto {
  @ApiProperty({ description: 'Ticket offer ID' })
  @IsUUID()
  ticketId!: string;

  @ApiProperty({ description: 'Event ID' })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ description: 'Star (creator) user ID receiving payout' })
  @IsUUID()
  starId!: string;

  @ApiProperty({ description: 'Number of tickets to purchase', minimum: 1, default: 1 })
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Idempotency key — prevents duplicate purchases' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
