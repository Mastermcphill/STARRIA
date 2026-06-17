import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AI Creator Tools — caption generation, title suggestions, hashtags,
 * thumbnail prompts, and script assistance for Stars.
 * Business logic: TODO (wire Anthropic / OpenAI SDK)
 */
@Injectable()
export class AiCreatorService {
  constructor(private readonly prisma: PrismaService) {}
}
