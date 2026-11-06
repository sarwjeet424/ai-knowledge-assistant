import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './database/prisma.service';
import { DocumentsModule } from './documents/documents.module';
import { AssistantsModule } from './assistants/assistants.module';
import { QuestionsModule } from './questions/questions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    AuthModule,
    DocumentsModule,
    AssistantsModule,
    QuestionsModule,
    AnalyticsModule,
  ],
  providers: [PrismaService],
  controllers: [HealthController],
})
export class AppModule {}
