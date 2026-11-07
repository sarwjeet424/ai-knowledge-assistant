import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { AssistantsModule } from './assistants/assistants.module';
import { QuestionsModule } from './questions/questions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    AuthModule,
    DocumentsModule,
    AssistantsModule,
    QuestionsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
