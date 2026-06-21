import { Global, Module, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryEventBus } from '@starria/domain-events';
import type { EventBus } from '@starria/domain-events';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { RedisStreamsEventBus } from './redis-event-bus';

export const EVENT_BUS = 'EVENT_BUS';

/**
 * In production (or when EVENT_BUS_DRIVER=redis) the durable Redis Streams bus
 * is used so domain events survive restarts. In development the in-memory bus
 * keeps tests/local runs dependency-light.
 */
@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: (config: ConfigService, redis: Redis): EventBus => {
        const driver =
          config.get<string>('EVENT_BUS_DRIVER') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'redis' : 'memory');
        return driver === 'redis'
          ? new RedisStreamsEventBus(redis)
          : new InMemoryEventBus();
      },
      inject: [ConfigService, REDIS_CLIENT],
    },
  ],
  exports: [EVENT_BUS],
})
export class EventBusModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(EVENT_BUS) private readonly bus: EventBus) {}

  async onModuleInit() {
    if (this.bus instanceof RedisStreamsEventBus) {
      await this.bus.start();
    }
  }

  async onModuleDestroy() {
    if (this.bus instanceof RedisStreamsEventBus) {
      await this.bus.stop();
    }
  }
}
