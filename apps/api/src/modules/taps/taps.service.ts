import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Taps = micropayments/gifts from Supporters to Stars.
 * Wraps @starria/gifting-core and @starria/wallet-core via port adapters.
 * Business logic: TODO
 */
@Injectable()
export class TapsService {
  constructor(private readonly prisma: PrismaService) {}
}
