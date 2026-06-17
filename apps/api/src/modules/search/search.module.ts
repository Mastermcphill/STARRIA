import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { PrismaSearchAdapter } from './prisma-search.adapter';

@Module({
  controllers: [SearchController],
  providers: [PrismaSearchAdapter],
  exports: [PrismaSearchAdapter],
})
export class SearchModule {}
