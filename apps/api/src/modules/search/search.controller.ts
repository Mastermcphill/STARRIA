import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from '@starria/search-core';
import { PrismaSearchAdapter } from './prisma-search.adapter';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  private readonly service: SearchService;

  constructor(adapter: PrismaSearchAdapter) {
    this.service = new SearchService(adapter);
  }

  @Get()
  @ApiOperation({ summary: 'Search published videos by creator, country, language, genre, or title' })
  async search(@Query() query: SearchQueryDto) {
    return this.service.search(query);
  }
}
