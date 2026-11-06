import {
  Injectable,
  Logger,
  NotFoundException,
  TooManyRequestsException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AskDto } from './ask.dto';
import { DecisionEngineService } from './decision-engine.service';

type RateBucket = { count: number; at: number };

/** Maximum number of context chunks sent to the LLM */
const MAX_CONTEXT_CHUNKS = 5;

/** Semantic similarity search fallback: keyword-based BM25-lite */
const STOPWORDS = new Set([
  'what','with','that','this','have','from','your','eligible','please',
  'does','about','which','there','their','they','into','would','could',
]);

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private readonly requests = new Map<string, RateBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: DecisionEngineService,
  ) {}

  async publicAssistant(token: string) {
    const assistant = await this.resolve(token);
    return {
      id: assistant.id,
      status: assistant.status,
      organizationName: assistant.organization.name,
    };
  }

  async ask(dto: AskDto, ip: string) {
    this.limit(ip);

    const assistant = await this.resolve(dto.assistantToken);
    const orgId = assistant.organizationId;
    const question = dto.question.trim().slice(0, 1000);

    // ---------------------------------------------------------------------------
    // Retrieve relevant chunks
    // ---------------------------------------------------------------------------
    const allChunks = await this.prisma.documentChunk.findMany({
      where: { organizationId: orgId, document: { processingStatus: 'READY' } },
      include: { document: { select: { id: true, filename: true } } },
    });

    const terms = this.terms(question);
    const ranked = allChunks
      .map((c) => ({
        ...c,
        score: terms.reduce((n, t) => n + (c.content.toLowerCase().includes(t) ? 1 : 0), 0),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CONTEXT_CHUNKS);

    // ---------------------------------------------------------------------------
    // Log the question
    // ---------------------------------------------------------------------------
    const questionType = this.classify(question);
    const log = await this.prisma.questionLog.create({
      data: {
        organizationId: orgId,
        assistantId: assistant.id,
        question,
        status: ranked.length ? 'ANSWERED' : 'UNABLE_TO_ANSWER',
        questionType,
        decisionRequired: /eligible|qualify|scholarship/i.test(question),
      },
    });

    if (!ranked.length) {
      return {
        success: true,
        status: 'unable_to_answer',
        answer:
          "I could not find enough relevant information in this organization's knowledge base to answer that.",
        references: [],
        decision: null,
      };
    }

    // ---------------------------------------------------------------------------
    // Run decision engine (deterministic — no AI calls)
    // ---------------------------------------------------------------------------
    const evidence = ranked.map((r) => r.content).join('\n');
    const decisions = await this.engine.evaluate(question, evidence);
    const combined = this.engine.combine(decisions);

    if (decisions.length) {
      await this.prisma.decisionExecution.createMany({
        data: decisions.map((d) => ({
          questionLogId: log.id,
          decisionType: d.type,
          decisionName: d.name,
          result: { type: d.type, name: d.name, result: d.result, reason: d.reason, status: d.status },
          status: d.status,
          executionTime: d.executionTimeMs,
        })),
      });
    }

    // ---------------------------------------------------------------------------
    // AI-generated answer
    // ---------------------------------------------------------------------------
    const answer = await this.generateAnswer(
      question,
      ranked,
      assistant.organization.name,
      combined,
    );

    const status =
      combined?.result === 'NEEDS_MORE_INFORMATION' ||
      combined?.result === 'HUMAN_REVIEW_REQUIRED'
        ? 'HUMAN_REVIEW'
        : 'ANSWERED';

    if (status !== 'ANSWERED') {
      await this.prisma.questionLog.update({ where: { id: log.id }, data: { status } });
    }

    const references = this.references(ranked);
    return {
      success: true,
      status: status.toLowerCase(),
      answer,
      references,
      decision: combined
        ? { required: true, ...combined, models: decisions }
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async resolve(token: string) {
    const tokenLookup = createHash('sha256').update(token).digest('hex');
    const assistant = await this.prisma.assistant.findUnique({
      where: { tokenLookup },
      include: { organization: { select: { name: true } } },
    });
    if (
      !assistant ||
      assistant.status !== 'ACTIVE' ||
      !(await bcrypt.compare(token, assistant.tokenHash))
    ) {
      throw new NotFoundException('Invalid assistant token');
    }
    return assistant;
  }

  private terms(q: string): string[] {
    return (
      q
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter((x) => !STOPWORDS.has(x)) ?? []
    );
  }

  private classify(q: string): string {
    if (/difference|compare|versus|vs\.?/i.test(q)) return 'COMPARISON';
    if (/how (do|can)|steps|process|apply/i.test(q)) return 'PROCEDURAL';
    if (/eligible|qualify|am i/i.test(q)) return 'MULTI_CONDITION_DECISION';
    if (/policy|allowed|can i/i.test(q)) return 'POLICY';
    return 'DIRECT_INFORMATION';
  }

  private references(
    rows: Array<{ document: { id: string; filename: string }; pageNumber: number }>,
  ) {
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        const k = `${r.document.id}:${r.pageNumber}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((r) => ({
        documentId: r.document.id,
        filename: r.document.filename,
        pageNumber: r.pageNumber,
      }));
  }

  /**
   * Generate an AI answer via the AI service, with keyword-excerpt fallback.
   */
  private async generateAnswer(
    question: string,
    rows: Array<{ content: string; document: { filename: string }; pageNumber: number }>,
    orgName: string,
    combined?: { result: string; reason: string },
  ): Promise<string> {
    const mockAI = process.env.MOCK_AI !== 'false';
    const aiUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

    if (!mockAI) {
      try {
        const contextChunks = rows.map(
          (r) => `[${r.document.filename}, page ${r.pageNumber}] ${r.content}`,
        );
        const response = await fetch(`${aiUrl}/answer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            question,
            context_chunks: contextChunks,
            organization_name: orgName,
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (response.status === 429) {
          this.logger.warn('AI answer endpoint rate limited — falling back to excerpt');
        } else if (response.ok) {
          const payload = (await response.json()) as { answer: string };
          this.logger.log(`AI answer generated for question: "${question.slice(0, 60)}..."`);
          if (combined) {
            return `${combined.reason}\n\n${payload.answer}`;
          }
          return payload.answer;
        } else {
          this.logger.warn(`AI answer endpoint returned ${response.status}`);
        }
      } catch (err: any) {
        this.logger.warn(`AI answer call failed: ${err?.message} — using excerpt fallback`);
      }
    }

    // ---------------------------------------------------------------------------
    // Fallback: keyword excerpt (always works, no AI dependency)
    // ---------------------------------------------------------------------------
    const excerpts = rows
      .slice(0, 2)
      .map(
        (r) =>
          `According to ${r.document.filename}, page ${r.pageNumber}: ${r.content.slice(0, 360).trim()}`,
      )
      .join('\n\n');

    return combined ? `${combined.reason}\n\n${excerpts}` : excerpts;
  }

  private limit(ip: string) {
    const now = Date.now();
    const bucket = this.requests.get(ip);
    if (!bucket || now - bucket.at > 60_000) {
      this.requests.set(ip, { count: 1, at: now });
      return;
    }
    if (bucket.count >= 30) {
      throw new TooManyRequestsException('Please wait before asking more questions');
    }
    bucket.count++;
  }
}
