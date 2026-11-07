import { Module } from '@nestjs/common';
import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';

const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export { STORAGE_PROVIDER };

/**
 * Selects S3StorageProvider (Neon Object Storage or any S3-compatible) when
 * STORAGE_BUCKET_NAME is set, otherwise falls back to LocalStorageProvider
 * (dev/test only — data lost on container restart).
 */
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): StorageProvider => {
        const isProduction = process.env.NODE_ENV === 'production';
        const hasS3Config =
          process.env.STORAGE_BUCKET_NAME &&
          process.env.STORAGE_ACCESS_KEY_ID &&
          process.env.STORAGE_SECRET_ACCESS_KEY &&
          process.env.STORAGE_ENDPOINT;

        if (isProduction && !hasS3Config) {
          throw new Error(
            'Production requires object storage: STORAGE_BUCKET_NAME, STORAGE_ACCESS_KEY_ID, ' +
            'STORAGE_SECRET_ACCESS_KEY, STORAGE_ENDPOINT',
          );
        }

        if (hasS3Config) {
          return new S3StorageProvider();
        }

        return new LocalStorageProvider();
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
