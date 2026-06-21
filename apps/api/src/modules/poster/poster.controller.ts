import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PosterService } from './poster.service';
import { GeneratePosterDto } from './dto/generate-poster.dto';

@ApiTags('posters')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('posters')
export class PosterController {
  constructor(private readonly posterService: PosterService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate an AI promotional poster (costs 50 coins)' })
  @ApiResponse({ status: 201, description: 'Poster generated — includes resultImageUrl' })
  generate(
    @Request() req: { user: { userId: string } },
    @Body() dto: GeneratePosterDto,
  ) {
    return this.posterService.generatePoster(req.user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the current creator's poster history" })
  getMyPosters(@Request() req: { user: { userId: string } }) {
    return this.posterService.getMyPosters(req.user.userId);
  }
}
