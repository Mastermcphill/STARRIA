import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Events = live streams, replays, classes hosted by Stars.
 * Integrates with @starria/video-core (upload/streaming) and
 * @starria/analytics-core (watch sessions).
 * Business logic: TODO
 */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}
}
