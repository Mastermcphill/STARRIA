import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class GeneratePosterDto {
  @ApiProperty({ description: 'Poster title (used as the main headline)' })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'Event type category',
    enum: ['COMEDY_SHOW', 'AI_PREMIERE', 'RAP_BATTLE', 'SING_OFF', 'CREATOR_QA', 'YAP_BATTLE', 'SUPPORTER_ROOM', 'LIVE_STREAM'],
  })
  @IsString()
  eventType!: string;

  @ApiPropertyOptional({ description: 'Event ID to associate the poster with' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ description: 'Date/time string for the event (displayed on poster)' })
  @IsOptional()
  @IsString()
  dateTime?: string;

  @ApiPropertyOptional({
    description: 'Visual style',
    enum: ['bold', 'minimal', 'cinematic', 'neon', 'afrobeats'],
    default: 'bold',
  })
  @IsOptional()
  @IsIn(['bold', 'minimal', 'cinematic', 'neon', 'afrobeats'])
  style?: string;

  @ApiPropertyOptional({ description: 'Creator image URL to embed in the poster' })
  @IsOptional()
  @IsString()
  creatorImageUrl?: string;
}
