import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import type { MediaPurpose } from './dto/media.dto';

/**
 * Per-purpose upload policy: which MIME types are permitted, which file
 * extensions may accompany them, and the maximum size. Because uploads go
 * directly to R2 via a presigned URL, this is the API's only chance to constrain
 * what a client is allowed to store — so we validate MIME, extension/MIME
 * agreement, and size before signing the URL.
 */
interface UploadPolicy {
  mimeTypes: Set<string>;
  extensions: Set<string>;
  maxBytes: number;
}

const MB = 1024 * 1024;

const POLICIES: Record<MediaPurpose, UploadPolicy> = {
  avatars: {
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    extensions: new Set(['.jpg', '.jpeg', '.png', '.webp']),
    maxBytes: 10 * MB,
  },
  images: {
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    extensions: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']),
    maxBytes: 25 * MB,
  },
  videos: {
    mimeTypes: new Set(['video/mp4', 'video/quicktime', 'video/webm']),
    extensions: new Set(['.mp4', '.mov', '.webm']),
    maxBytes: 2 * 1024 * MB, // 2 GB
  },
};

// Maps a MIME type to the extensions that legitimately represent it, so a client
// cannot pair `image/png` with a `.mp4` name (or vice-versa) to smuggle content.
const MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
};

export interface UploadRequestLike {
  purpose: MediaPurpose;
  fileName: string;
  contentType: string;
  size?: number;
}

/** Validate an upload request against its purpose policy. Throws on violation. */
export function validateUpload(dto: UploadRequestLike): void {
  const policy = POLICIES[dto.purpose];
  if (!policy) {
    throw new BadRequestException(`Unknown upload purpose: ${dto.purpose}`);
  }

  const contentType = dto.contentType?.toLowerCase().trim();
  if (!contentType || !policy.mimeTypes.has(contentType)) {
    throw new BadRequestException(
      `contentType "${dto.contentType}" is not allowed for ${dto.purpose}. ` +
        `Allowed: ${[...policy.mimeTypes].join(', ')}`,
    );
  }

  const ext = extname(dto.fileName ?? '').toLowerCase();
  if (!ext || !policy.extensions.has(ext)) {
    throw new BadRequestException(
      `File extension "${ext || '(none)'}" is not allowed for ${dto.purpose}.`,
    );
  }

  const expectedExts = MIME_EXTENSIONS[contentType] ?? [];
  if (!expectedExts.includes(ext)) {
    throw new BadRequestException(
      `File extension "${ext}" does not match content type "${contentType}".`,
    );
  }

  if (dto.size !== undefined && dto.size > policy.maxBytes) {
    throw new BadRequestException(
      `File size ${dto.size} exceeds the ${policy.maxBytes}-byte limit for ${dto.purpose}.`,
    );
  }
}
