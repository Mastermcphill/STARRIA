import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PRESIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private client!: S3Client;
  private bucket!: string;
  private publicBaseUrl!: string;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    this.bucket = this.config.get<string>('R2_BUCKET') ?? '';
    this.publicBaseUrl = (this.config.get<string>('R2_PUBLIC_BASE_URL') ?? '').replace(/\/$/, '');

    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.warn('R2 credentials not configured — presigned URL generation will fail at runtime');
      return;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.enabled = true;
    this.logger.log(`R2 storage ready — bucket: ${this.bucket}`);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Generate a presigned PUT URL that the client uses to upload directly to R2.
   * Returns the URL and the object key.
   */
  async createPresignedUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; expiresAt: Date }> {
    if (!this.enabled) {
      throw new Error('R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });

    const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000);
    return { uploadUrl, expiresAt };
  }

  /** Derive the public CDN URL for a stored object key. */
  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
