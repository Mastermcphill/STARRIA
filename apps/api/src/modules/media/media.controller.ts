import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import {
  CompleteUploadDto,
  MediaResponseDto,
  RequestUploadUrlDto,
  UploadUrlResponseDto,
} from './dto/media.dto';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Request a presigned PUT URL for direct upload to R2' })
  @ApiResponse({ status: 201, type: UploadUrlResponseDto })
  requestUploadUrl(
    @Request() req: { user: { userId: string } },
    @Body() dto: RequestUploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    return this.mediaService.requestUploadUrl(req.user.userId, dto);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark an upload as complete after the client PUT succeeds' })
  @ApiResponse({ status: 200, type: MediaResponseDto })
  completeUpload(
    @Request() req: { user: { userId: string } },
    @Body() dto: CompleteUploadDto,
  ): Promise<MediaResponseDto> {
    return this.mediaService.completeUpload(req.user.userId, dto.uploadId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media metadata by ID' })
  @ApiResponse({ status: 200, type: MediaResponseDto })
  getById(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ): Promise<MediaResponseDto> {
    return this.mediaService.getById(req.user.userId, id);
  }
}
