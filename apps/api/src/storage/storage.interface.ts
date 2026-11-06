/**
 * Storage provider abstraction.
 * Production: Cloudflare R2 (S3-compatible)
 * Development: Local filesystem
 */
export interface StorageProvider {
  /**
   * Upload a file buffer.
   * Returns the object key (not a public URL).
   */
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;

  /**
   * Download a file as a Buffer.
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file by key.
   */
  delete(key: string): Promise<void>;

  /**
   * Check whether an object exists.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Provider name for logging/debugging.
   */
  readonly providerName: string;
}
