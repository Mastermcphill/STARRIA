import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsBoolean, IsInt, IsIn, IsUUID, IsNumber,
  Min, MaxLength, MinLength, IsDateString, Max,
} from 'class-validator';

const BATTLE_TYPES = ['RAP_BATTLE','SING_OFF','COMEDY_CLASH','YAP_BATTLE','AI_FILM_BATTLE','CREATOR_DUEL','TEAM_BATTLE'];
const VOTING_METHODS = ['AUDIENCE','SUPPORTER_WEIGHTED','JUDGE','HYBRID'];
const PRIZE_DISTROS = ['WINNER_TAKES_ALL','TOP_3_PAYOUT','SPLIT_PAYOUT'];
const ROLES = ['CHALLENGER','DEFENDER','TEAM_MEMBER','JUDGE'];
const PRIZE_SOURCES = ['TICKETS','SPONSORSHIP','CREATOR_DEPOSIT','FAN_CONTRIBUTION'];

export class CreateBattleDto {
  @ApiProperty({ example: 'Rap Battle Friday', description: 'Battle title' })
  @IsString() @MinLength(1) @MaxLength(120)
  title!: string;

  @ApiProperty({ enum: BATTLE_TYPES })
  @IsIn(BATTLE_TYPES)
  type!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional({ enum: VOTING_METHODS }) @IsOptional() @IsIn(VOTING_METHODS) votingMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() arenaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() arenaSeasonId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isTeamBattle?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(2) @Max(64) maxParticipants?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiPropertyOptional({ enum: PRIZE_DISTROS }) @IsOptional() @IsIn(PRIZE_DISTROS) prizeDistribution?: string;
}

export class JoinBattleDto {
  @ApiProperty() @IsUUID() starProfileId!: string;
  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
}

export class CastVoteDto {
  // voterId is derived from the authenticated JWT server-side and ignored if
  // supplied by the client — prevents the self-vote bypass (P1-05).
  @ApiPropertyOptional({ description: 'Ignored — voter is taken from the auth token' })
  @IsOptional() @IsString()
  voterId?: string;

  @ApiProperty() @IsUUID() targetParticipantId!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isJudgeVote?: boolean;
}

export class ContributePrizeDto {
  // contributorId is derived from the JWT server-side.
  @ApiPropertyOptional({ description: 'Ignored — contributor is taken from the auth token' })
  @IsOptional() @IsString()
  contributorId?: string;

  @ApiProperty({ enum: PRIZE_SOURCES }) @IsIn(PRIZE_SOURCES) source!: string;
  @ApiProperty() @IsNumber() @Min(1) coins!: number;
}

export class CreateSeasonDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty() @IsInt() @Min(1) number!: number;
  @ApiProperty() @IsDateString() startsAt!: string;
  @ApiProperty() @IsDateString() endsAt!: string;
}
