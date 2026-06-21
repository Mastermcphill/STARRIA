import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from './r2.service';
import type { RequestUploadUrlDto, UploadUrlResponseDto, MediaResponseDto } from './dto/media.dto';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { validateUpload } from './upload-validation';

@Injectable()
export class MediaService {
  constructor(
    private readonly db: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto): Promise<UploadUrlResponseDto> {
    // Constrain MIME / extension / size before signing — the only server-side
    // gate on direct-to-R2 uploads.
    validateUpload(dto);
    const ext = extname(dto.fileName) || '';
    const key = `${dto.purpose}/${randomUUID()}${ext}`;

    const { uploadUrl, expiresAt } = await this.r2.createPresignedUploadUrl(key, dto.contentType);

    const record = await this.db.mediaUpload.create({
      data: {
        userId,
        purpose: dto.purpose,
        fileName: dto.fileName,
        contentType: dto.contentType,
        size: dto.size,
        storageKey: key,
        fileUrl: this.r2.publicUrl(key),
        expiresAt,
        status: 'PENDING',
      },
    });

    return {
      uploadId: record.id,
      uploadUrl,
      key,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeUpload(userId: string, uploadId: string): Promise<MediaResponseDto> {
    const record = await this.db.mediaUpload.findFirst({
      where: { id: uploadId, userId },
    });
    if (!record) throw new NotFoundException('Upload record not found');

    const updated = await this.db.mediaUpload.update({
      where: { id: uploadId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    return this.toResponse(updated);
  }

  async getById(userId: string, id: string): Promise<MediaResponseDto> {
    const record = await this.db.mediaUpload.findFirst({
      where: { id, userId },
    });
    if (!record) throw new NotFoundException('Media not found');
    return this.toResponse(record);
  }

  private toResponse(r: {
    id: string;
    storageKey: string;
    fileUrl: string | null;
    contentType: string;
    size: number | null;
    purpose: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
  }): MediaResponseDto {
    return {
      id: r.id,
      key: r.storageKey,
      url: r.fileUrl ?? this.r2.publicUrl(r.storageKey),
      contentType: r.contentType,
      size: r.size ?? undefined,
      purpose: r.purpose,
      status: r.status,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? undefined,
    };
  }
}
