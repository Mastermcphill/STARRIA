import { Global, Module } from '@nestjs/common';
import { InMemoryEventBus } from '@starria/domain-events';
import type { EventBus } from '@starria/domain-events';

export const EVENT_BUS = 'EVENT_BUS';

@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: (): EventBus => new InMemoryEventBus(),
    },
  ],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
