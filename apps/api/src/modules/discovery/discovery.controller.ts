import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  DiscoveryService,
  LocalDiscoveryService,
  TrendingService,
  GLOBAL_SCOPE,
} from '@starria/discovery-core';
import type { Genre } from '@starria/discovery-core';
import { resolveLocation } from '@starria/geo-core';
import { PrismaDiscoveryFeedAdapter } from './prisma-discovery-feed.adapter';
import { PrismaTrendingStoreAdapter } from './prisma-trending-store.adapter';
import { VerticalFeedQueryDto, LocalFeedQueryDto } from './dto/discovery-query.dto';

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  private readonly discovery: DiscoveryService;
  private readonly localDiscovery: LocalDiscoveryService;
  private readonly trending: TrendingService;

  constructor(
    feed: PrismaDiscoveryFeedAdapter,
    trendingStore: PrismaTrendingStoreAdapter,
  ) {
    this.discovery = new DiscoveryService(feed);
    this.localDiscovery = new LocalDiscoveryService(feed, trendingStore);
    this.trending = new TrendingService(trendingStore);
  }

  @Get('genres')
  @ApiOperation({ summary: 'List discovery genres (horizontal swipe rail)' })
  genres() {
    return this.discovery.genres();
  }

  @Get('feed')
  @ApiOperation({ summary: 'Vertical swipe — more content in a genre, ranked by discovery score' })
  feed(@Query() q: VerticalFeedQueryDto) {
    return this.discovery.getVerticalFeed({
      genre: q.genre as Genre,
      filters: { country: q.country, language: q.language },
      cursor: q.cursor,
      limit: q.limit,
    });
  }

  @Get('matrix')
  @ApiOperation({ summary: 'Discovery matrix — top items per genre' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'language', required: false })
  matrix(@Query('country') country?: string, @Query('language') language?: string) {
    return this.discovery.getMatrix({ filters: { country, language } });
  }

  @Get('local')
  @ApiOperation({ summary: 'Local feed — top content in the viewer’s country' })
  local(@Query() q: LocalFeedQueryDto, @Headers('x-country') headerCountry?: string) {
    const country = resolveLocation({ country: q.country ?? headerCountry }).country;
    return this.localDiscovery.getLocalFeed({
      country,
      genre: q.genre as Genre | undefined,
      limit: q.limit,
    });
  }

  @Get('trending')
  @ApiOperation({ summary: 'Global trending rail' })
  @ApiQuery({ name: 'limit', required: false })
  trendingGlobal(@Query('limit') limit = 20) {
    return this.trending.getGlobalTrending(+limit);
  }

  @Get('trending/:region')
  @ApiOperation({ summary: 'Local/regional trending rail (region or country code)' })
  @ApiQuery({ name: 'limit', required: false })
  trendingLocal(@Param('region') region: string, @Query('limit') limit = 20) {
    const scope = region.toUpperCase() === GLOBAL_SCOPE ? GLOBAL_SCOPE : region;
    return this.trending.getLocalTrending(scope, +limit);
  }
}
