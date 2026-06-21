import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { REDIS_CLIENT } from './redis/redis.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { applySecurityHeaders } from './common/security-headers';

/**
 * After the app is created, confirm the hard dependencies (PostgreSQL, Redis)
 * are actually reachable. In production an unreachable dependency aborts boot
 * so the orchestrator never routes traffic to a broken pod; in development we
 * log a warning so local work without infra is still possible.
 */
async function verifyCriticalDependencies(app: NestFastifyApplication) {
  const isProd = process.env.NODE_ENV === 'production';
  const failures: string[] = [];

  try {
    await app.get(PrismaService).$queryRaw`SELECT 1`;
  } catch (e) {
    failures.push(`database unavailable: ${(e as Error).message}`);
  }

  try {
    const redis = app.get<Redis>(REDIS_CLIENT);
    const pong = await redis.ping();
    if (pong !== 'PONG') failures.push('redis ping returned non-PONG');
  } catch (e) {
    failures.push(`redis unavailable: ${(e as Error).message}`);
  }

  if (failures.length) {
    const msg = `Critical dependency check failed:\n  - ${failures.join('\n  - ')}`;
    if (isProd) throw new Error(msg);
    Logger.warn(msg, 'Bootstrap');
  }
}

/**
 * Fail fast in production on insecure config. Booting with the default
 * JWT_SECRET means anyone who reads .env.example can forge tokens.
 */
function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const errors: string[] = [];

  const required: string[] = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'R2_BUCKET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ];
  for (const key of required) {
    if (!process.env[key]) errors.push(`${key} is required`);
  }

  const secret = process.env.JWT_SECRET;
  if (secret && (secret === 'change-me-in-production' || secret.length < 32)) {
    errors.push('JWT_SECRET must be a strong value (>=32 chars) in production');
  }

  if (!process.env.CORS_ORIGINS) {
    Logger.warn('CORS_ORIGINS not set — cross-origin requests will be blocked', 'Bootstrap');
  }
  if (errors.length) {
    throw new Error(`Insecure production config:\n  - ${errors.join('\n  - ')}`);
  }
}

async function bootstrap() {
  validateProductionConfig();

  // Body-size limit: the API itself never receives large payloads (media uploads
  // go directly to R2 via presigned URLs), so a tight default protects against
  // memory-exhaustion DoS. Override with REQUEST_BODY_LIMIT_BYTES if needed.
  const bodyLimit = Number(process.env.REQUEST_BODY_LIMIT_BYTES ?? 1_048_576); // 1 MB
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit,
      // Honour X-Forwarded-For behind the load balancer so rate-limiting and
      // webhook IP allowlists see the real client IP.
      trustProxy: process.env.TRUST_PROXY !== 'false',
    }),
    // rawBody is required for HMAC verification of payment-provider webhooks.
    { rawBody: true },
  );

  // Security headers (helmet-equivalent) on every response.
  applySecurityHeaders(app.getHttpAdapter().getInstance());

  await verifyCriticalDependencies(app);

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');

  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    // NOTE: forbidNonWhitelisted is intentionally OFF until every DTO carries
    // class-validator decorators — otherwise decorator-less DTOs (most of
    // Sprints 5–8) would reject all their fields. Tracked in security report.
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('STARRIA API')
    .setDescription('STARRIA platform — Stars, Supporters, Taps, Events, Arenas')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Locked-down CORS. Set CORS_ORIGINS to a comma-separated allowlist.
  // In development (no list set) we allow all origins for convenience; in
  // production an unset list means no cross-origin access (mobile app uses
  // native HTTP, not CORS-bound).
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const corsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400, // cache preflight 24h
  };
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, ...corsOptions });
  } else if (process.env.NODE_ENV !== 'production') {
    app.enableCors({ origin: true, ...corsOptions });
  }
  // production + empty list → CORS disabled (no app.enableCors call)

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
