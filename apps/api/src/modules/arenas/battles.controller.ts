import {
  Controller, Get, Post, Param, Body, Query, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BattlesService } from './battles.service';
import { Roles } from '../auth/roles.decorator';
import { CreateBattleDto, JoinBattleDto, CastVoteDto, ContributePrizeDto, CreateSeasonDto } from './dto/battle.dto';

type AuthedReq = { user: { userId: string } };

@ApiTags('arenas')
@ApiBearerAuth()
@Controller('arenas')
export class BattlesController {
  constructor(private readonly svc: BattlesService) {}

  // ── Static routes FIRST ───────────────────────────────────────────────────
  // Declared before the parametric `:id` routes so the route table never treats
  // `leaderboard` / `seasons` / `houses` as a battle id (P2-06 fix). Fastify's
  // router also prioritises static over parametric, but ordering makes the
  // intent explicit and is robust across routers.

  @Get('leaderboard/global')
  @ApiOperation({ summary: 'Global ELO leaderboard' })
  @ApiQuery({ name: 'seasonId', required: false })
  @ApiQuery({ name: 'division', required: false, enum: ['BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','LEGEND'] })
  @ApiQuery({ name: 'limit', required: false })
  getLeaderboard(
    @Query('seasonId') seasonId?: string,
    @Query('division') division?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getLeaderboard(seasonId, division, limit ? parseInt(limit, 10) : 50);
  }

  @Post('seasons')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an arena season (admin only)' })
  createSeason(@Body() dto: CreateSeasonDto) {
    return this.svc.createSeason(dto);
  }

  @Get('seasons/active')
  @ApiOperation({ summary: 'Get the active arena season' })
  getActiveSeason() {
    return this.svc.getActiveSeason();
  }

  @Post('seasons/:id/reset')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'End and soft-reset ELO for a season (admin only)' })
  @HttpCode(HttpStatus.OK)
  resetSeason(@Param('id') id: string) {
    return this.svc.resetSeason(id);
  }

  @Get('houses')
  @ApiOperation({ summary: 'List all creator houses' })
  listHouses() {
    return this.svc.listHouses();
  }

  @Get('houses/:id')
  @ApiOperation({ summary: 'Get a creator house with members' })
  getHouse(@Param('id') id: string) {
    return this.svc.getHouse(id);
  }

  // ── Battles CRUD ──────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new battle' })
  @ApiResponse({ status: 201, description: 'Battle created' })
  createBattle(@Body() dto: CreateBattleDto) {
    return this.svc.createBattle(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List battles' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT','REGISTRATION','ACTIVE','VOTING','SETTLED','ARCHIVED'] })
  @ApiQuery({ name: 'type', required: false })
  listBattles(@Query('status') status?: string, @Query('type') type?: string) {
    return this.svc.listBattles(status, type);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a battle (registration)' })
  @HttpCode(HttpStatus.OK)
  joinBattle(@Param('id') id: string, @Body() dto: JoinBattleDto) {
    return this.svc.joinBattle(id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a battle (moves to ACTIVE)' })
  @HttpCode(HttpStatus.OK)
  startBattle(@Param('id') id: string) {
    return this.svc.startBattle(id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End a battle (moves to VOTING)' })
  @HttpCode(HttpStatus.OK)
  endBattle(@Param('id') id: string) {
    return this.svc.endBattle(id);
  }

  @Post(':id/settle')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Settle a battle: tally votes, award ELO, distribute prizes (admin only)' })
  @HttpCode(HttpStatus.OK)
  settleBattle(@Param('id') id: string) {
    return this.svc.settleBattle(id);
  }

  // ── Voting ────────────────────────────────────────────────────────────────

  @Post(':id/vote')
  @ApiOperation({ summary: 'Cast a weighted vote in a battle' })
  @HttpCode(HttpStatus.OK)
  castVote(@Param('id') id: string, @Body() dto: CastVoteDto, @Request() req: AuthedReq) {
    // voterId always comes from the authenticated user — body value is ignored
    // to prevent vote spoofing / self-vote bypass (P1-05).
    return this.svc.castVote(id, { ...dto, voterId: req.user.userId });
  }

  // ── Prize Pool ────────────────────────────────────────────────────────────

  @Post(':id/prize-pool/contribute')
  @ApiOperation({ summary: 'Contribute to a battle prize pool' })
  @HttpCode(HttpStatus.OK)
  contribute(@Param('id') id: string, @Body() dto: ContributePrizeDto, @Request() req: AuthedReq) {
    return this.svc.contributeToPrizePool(id, { ...dto, contributorId: req.user.userId });
  }

  // ── Parametric battle lookup LAST ─────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get battle by id' })
  getBattle(@Param('id') id: string) {
    return this.svc.getBattle(id);
  }
}
