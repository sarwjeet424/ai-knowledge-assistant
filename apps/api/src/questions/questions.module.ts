import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { DecisionEngineService } from './decision-engine.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, DecisionEngineService],
})
export class QuestionsModule {}
