import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from './storage.interface';

/**
 * Cloudflare R2 storage provider using S3-compatible API.
 * 
 * Required env vars:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_ENDPOINT  (https://<account_id>.r2.cloudflarestorage.com)
 */
@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  readonly providerName = 'r2';

  private client: any;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME ?? '';
    if (!this.bucketName) throw new Error('R2_BUCKET_NAME is not configured');

    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are incomplete: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are required');
    }

    // Lazy import to avoid loading @aws-sdk in environments where it's not needed
    const { S3Client } = require('@aws-sdk/client-s3');
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
    });

    this.logger.log(`R2StorageProvider initialised (bucket=${this.bucketName})`);
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
    this.logger.debug(`Uploaded ${key} to R2`);
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
    this.logger.debug(`Deleted ${key} from R2`);
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
