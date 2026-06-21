import { Controller, Get, Inject, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type Redis from 'ioredis';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { RoomServiceClient } from 'livekit-server-sdk';

type CheckState = 'ok' | 'down';
type ConfigState = 'configured' | 'unconfigured';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe — process is up' })
  health() {
    return { status: 'ok', uptime: process.uptime() };
  }

  // Kubernetes-style alias for the liveness probe.
  @Public()
  @Get('health/live')
  @ApiOperation({ summary: 'Liveness probe (alias) — process is up' })
  liveness() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe — hard deps (DB, Redis) reachable + external config presence' })
  async readiness() {
    // Hard dependencies — a failure here makes the pod NOT ready.
    const hard: Record<string, CheckState> = { database: 'down', redis: 'down' };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      hard.database = 'ok';
    } catch {
      hard.database = 'down';
    }

    try {
      const pong = await this.redis.ping();
      hard.redis = pong === 'PONG' ? 'ok' : 'down';
    } catch {
      hard.redis = 'down';
    }

    // External integrations — reported for observability; presence of credentials
    // only (a live ping would couple readiness to third-party uptime).
    const cfg = (...keys: string[]): ConfigState =>
      keys.every((k) => Boolean(this.config.get<string>(k))) ? 'configured' : 'unconfigured';

    const integrations: Record<string, ConfigState> = {
      livekit: cfg('LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'),
      paystack: cfg('PAYSTACK_SECRET_KEY'),
      fcm: cfg('FCM_PROJECT_ID'),
      apple_iap: cfg('APPLE_IAP_KEY_ID'),
      google_play: cfg('GOOGLE_PLAY_SERVICE_ACCOUNT'),
    };

    const healthy = Object.values(hard).every((v) => v === 'ok');
    return { status: healthy ? 'ok' : 'degraded', checks: hard, integrations };
  }

  @Public()
  @Get('health/db')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Database connectivity probe' })
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }

  @Public()
  @Get('health/redis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redis connectivity probe' })
  async redis_check() {
    try {
      const pong = await this.redis.ping();
      return { status: pong === 'PONG' ? 'ok' : 'down' };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }

  @Public()
  @Get('health/livekit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'LiveKit connectivity probe' })
  async livekit() {
    const host = this.config.get<string>('LIVEKIT_HOST') ?? this.config.get<string>('LIVEKIT_URL') ?? '';
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY') ?? '';
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET') ?? '';
    if (!host || !apiKey || !apiSecret) {
      return { status: 'unconfigured' };
    }
    try {
      const svc = new RoomServiceClient(host, apiKey, apiSecret);
      await svc.listRooms();
      return { status: 'ok' };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }

  @Public()
  @Get('health/storage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cloudflare R2 storage probe' })
  async storage() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID') ?? '';
    const bucket = this.config.get<string>('R2_BUCKET') ?? '';
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    if (!bucket || !accessKeyId || !secretAccessKey) {
      return { status: 'unconfigured' };
    }
    try {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return { status: 'ok' };
    } catch (e) {
      return { status: 'down', error: (e as Error).message };
    }
  }
}
