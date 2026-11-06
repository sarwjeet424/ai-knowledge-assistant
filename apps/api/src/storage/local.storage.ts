import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';
import { StorageProvider } from './storage.interface';

/**
 * Local filesystem storage — development / testing only.
 * Files stored under {CWD}/../../storage/uploads/{key}
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  readonly providerName = 'local';

  private basePath(): string {
    return resolve(process.cwd(), '../../storage/uploads');
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const filePath = join(this.basePath(), key);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);
    this.logger.debug(`Uploaded ${key} to local storage`);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = join(this.basePath(), key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath(), key);
    await rm(filePath, { force: true });
    this.logger.debug(`Deleted ${key} from local storage`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(join(this.basePath(), key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
