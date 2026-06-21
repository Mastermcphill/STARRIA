import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature flag for the replay subsystem. The replay media pipeline
 * (transcode / thumbnails / metadata) is currently stubbed, so replay is
 * shipped DISABLED by default. With REPLAYS_ENABLED unset or not exactly
 * 'true', every guarded route returns a clean 503 instead of exercising the
 * stub pipeline. Flip REPLAYS_ENABLED=true once real media processing lands.
 */
@Injectable()
export class ReplaysEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  static isEnabled(config: ConfigService): boolean {
    return (config.get<string>('REPLAYS_ENABLED') ?? 'false').toLowerCase() === 'true';
  }

  canActivate(_context: ExecutionContext): boolean {
    if (ReplaysEnabledGuard.isEnabled(this.config)) return true;
    throw new ServiceUnavailableException({
      feature: 'replays',
      enabled: false,
      message: 'Replays are not available yet.',
    });
  }
}
