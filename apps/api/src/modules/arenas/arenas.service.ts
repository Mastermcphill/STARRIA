import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Arenas = LiveKit rooms owned by Stars.
 * Integrates with LiveKit for room token generation.
 * Business logic: TODO
 */
@Injectable()
export class ArenasService {
  constructor(private readonly prisma: PrismaService) {}
}
