import { Module } from '@nestjs/common';
import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';
import { R2StorageProvider } from './r2.storage';

const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export { STORAGE_PROVIDER };

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (): StorageProvider => {
        const isProduction = process.env.NODE_ENV === 'production';
        const hasR2Config =
          process.env.R2_BUCKET_NAME &&
          process.env.R2_ACCESS_KEY_ID &&
          process.env.R2_SECRET_ACCESS_KEY &&
          process.env.R2_ENDPOINT;

        if (isProduction && !hasR2Config) {
          throw new Error(
            'Production deployment requires R2 configuration: R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT',
          );
        }

        if (hasR2Config) {
          return new R2StorageProvider();
        }

        return new LocalStorageProvider();
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
