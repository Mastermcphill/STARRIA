import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { VideoService } from './video.service';
import { UploadVideoDto, VideoResponseDto } from './dto/upload-video.dto';

@ApiTags('video')
@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Upload + process + publish a video (creators only)' })
  @ApiResponse({ status: 201, type: VideoResponseDto })
  async upload(
    @Request() req: { user: { userId: string } },
    @Body() dto: UploadVideoDto,
  ): Promise<VideoResponseDto> {
    const v = await this.videoService.upload(req.user.userId, dto);
    return { id: v.id, status: v.status, title: v.title, genre: v.genre, playbackUrl: v.playbackUrl, thumbnailUrl: v.thumbnailUrl };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a video by ID' })
  async getById(@Param('id') id: string) {
    return this.videoService.getById(id);
  }
}
