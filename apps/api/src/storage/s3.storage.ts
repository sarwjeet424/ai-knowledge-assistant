import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from './storage.interface';

/**
 * S3-compatible object storage provider.
 *
 * Works with Neon Object Storage (or any S3-compatible endpoint).
 *
 * Required env vars:
 *   STORAGE_BUCKET_NAME          — name of the bucket
 *   STORAGE_ENDPOINT             — e.g. https://<branch-id>.storage.<region>.aws.neon.tech
 *   STORAGE_ACCESS_KEY_ID        — S3 access key / Neon storage key ID
 *   STORAGE_SECRET_ACCESS_KEY    — S3 secret / Neon storage secret
 *   STORAGE_REGION               — e.g. us-east-2
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  readonly providerName = 's3';

  private client: any;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.STORAGE_BUCKET_NAME ?? '';
    if (!this.bucketName) throw new Error('STORAGE_BUCKET_NAME is not configured');

    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const region = process.env.STORAGE_REGION ?? 'us-east-2';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Object storage credentials incomplete. Required: STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY',
      );
    }

    // Lazy import — not loaded unless storage is actually used
    const { S3Client } = require('@aws-sdk/client-s3');
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // Required for most S3-compatible endpoints (Neon, MinIO, etc.)
    });

    this.logger.log(
      `S3StorageProvider initialised (bucket=${this.bucketName} endpoint=${endpoint})`,
    );
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.debug(`Uploaded ${key} (${buffer.length} bytes)`);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
    const stream = response.Body;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
    this.logger.debug(`Deleted ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
