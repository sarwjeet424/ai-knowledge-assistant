import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { StorageProvider } from '../storage/storage.interface';
import { STORAGE_PROVIDER } from '../storage/storage.module';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES = 20;
const MAX_DOCUMENTS = 10;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  list(orgId: string) {
    return this.prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        fileSize: true,
        pageCount: true,
        processingStatus: true,
        processingError: true,
        createdAt: true,
      },
    });
  }

  async upload(orgId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A PDF file is required');
    if (file.size > MAX_BYTES) throw new PayloadTooLargeException('PDF must be 10 MB or smaller');

    // Validate PDF signature
    if (
      file.mimetype !== 'application/pdf' ||
      file.buffer.subarray(0, 5).toString() !== '%PDF-'
    ) {
      throw new BadRequestException('Invalid PDF file signature');
    }

    // Quick page-count guard from raw bytes
    const rawText = file.buffer.toString('latin1');
    const apparentPageCount = (rawText.match(/\/Type\s*\/Page\b/g) || []).length;
    if (apparentPageCount > MAX_PAGES) {
      throw new BadRequestException('PDF may contain no more than 20 pages');
    }

    // Check document quota
    if (await this.prisma.document.count({ where: { organizationId: orgId } }) >= MAX_DOCUMENTS) {
      throw new BadRequestException('Each organization may have no more than 10 PDFs');
    }

    // Extract chunks via AI service
    const extraction = await this.extractChunks(file.buffer);
    if (extraction.pageCount === 0 || !extraction.chunks.length) {
      throw new BadRequestException('PDF does not contain extractable text');
    }
    if (extraction.pageCount > MAX_PAGES) {
      throw new BadRequestException('PDF may contain no more than 20 pages');
    }

    // Upload to storage (R2 in production, local in dev)
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_');
    const storageKey = `${orgId}/${randomUUID()}.pdf`;
    await this.storage.upload(storageKey, file.buffer, 'application/pdf');

    try {
      // Create DB record and chunks in a transaction
      const document = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const doc = await tx.document.create({
          data: {
            organizationId: orgId,
            filename: safeFilename,
            storagePath: storageKey,
            fileSize: file.size,
            pageCount: extraction.pageCount,
            processingStatus: 'PROCESSING',
          },
        });

        // Store chunks (without embeddings initially)
        await tx.documentChunk.createMany({
          data: extraction.chunks.map((chunk) => ({
            organizationId: orgId,
            documentId: doc.id,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            content: chunk.content,
          })),
        });

        return tx.document.update({
          where: { id: doc.id },
          data: { processingStatus: 'READY' },
        });
      });

      // Generate embeddings asynchronously (non-blocking)
      this.generateEmbeddings(orgId, document.id).catch((err) =>
        this.logger.error(`Embedding generation failed for doc ${document.id}: ${err?.message}`),
      );

      return document;
    } catch (error) {
      // Rollback storage if DB transaction fails
      await this.storage.delete(storageKey).catch(() => {});
      throw error;
    }
  }

  async get(orgId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId: orgId },
      select: {
        id: true,
        filename: true,
        fileSize: true,
        pageCount: true,
        processingStatus: true,
        processingError: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async remove(orgId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!document) throw new NotFoundException('Document not found');

    // Delete from DB (cascades to chunks via schema)
    await this.prisma.document.delete({ where: { id } });

    // Delete from storage (best-effort)
    await this.storage.delete(document.storagePath).catch((err) =>
      this.logger.warn(`Storage delete failed for ${document.storagePath}: ${err?.message}`),
    );

    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async extractChunks(buffer: Buffer): Promise<{
    pageCount: number;
    chunks: Array<{ pageNumber: number; content: string; chunkIndex: number }>;
  }> {
    const base64 = buffer.toString('base64');
    const aiUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

    try {
      const response = await fetch(`${aiUrl}/extract`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content_base64: base64 }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new BadRequestException(`PDF text extraction failed: ${err}`);
      }

      const payload = (await response.json()) as {
        page_count: number;
        chunks: Array<{ page_number: number; content: string; chunk_index: number }>;
      };

      return {
        pageCount: payload.page_count,
        chunks: payload.chunks.map((c) => ({
          pageNumber: c.page_number,
          content: c.content,
          chunkIndex: c.chunk_index,
        })),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (process.env.MOCK_AI === 'true') {
        // Fallback for local dev when AI service isn't running
        this.logger.warn('AI service unreachable — using fallback chunker');
        const text = buffer.toString('latin1').replace(/[^\x20-\x7E\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length || 1;
        const chunks = this.fallbackChunks(text);
        return {
          pageCount,
          chunks: chunks.map((content, i) => ({ pageNumber: 1, content, chunkIndex: i })),
        };
      }
      throw new ServiceUnavailableException('AI service is unavailable. Please try again later.');
    }
  }

  private fallbackChunks(raw: string): string[] {
    const text = raw.trim();
    if (text.length < 30) return [];
    const size = 800, overlap = 120;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size - overlap) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Generate vector embeddings for all chunks of a document via the AI service.
   * Called asynchronously after the document is marked READY.
   * Uses pgvector $executeRaw to store the vector directly.
   */
  private async generateEmbeddings(orgId: string, documentId: string): Promise<void> {
    const mockAI = process.env.MOCK_AI !== 'false';
    if (mockAI) {
      this.logger.debug('MOCK_AI=true — skipping embedding generation');
      return;
    }

    const aiUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

    try {
      const chunks = await this.prisma.documentChunk.findMany({
        where: { documentId, organizationId: orgId },
        orderBy: { chunkIndex: 'asc' },
        select: { id: true, content: true },
      });

      if (!chunks.length) return;

      // Batch embed all chunks
      const response = await fetch(`${aiUrl}/embed-batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: chunks.map((c: { id: string; content: string }) => c.content) }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        this.logger.warn(`Embedding API returned ${response.status} for doc ${documentId}`);
        return;
      }

      const payload = (await response.json()) as {
        embeddings: number[][];
      };

      // Store each embedding using pgvector raw SQL
      for (let i = 0; i < chunks.length; i++) {
        const vec = payload.embeddings[i];
        if (!vec?.length) continue;
        const vectorLiteral = `[${vec.join(',')}]`;
        await this.prisma.$executeRaw`
          UPDATE "DocumentChunk"
          SET embedding = ${vectorLiteral}::vector
          WHERE id = ${chunks[i].id}
        `;
      }

      this.logger.log(`Generated embeddings for ${chunks.length} chunks of doc ${documentId}`);
    } catch (err: any) {
      this.logger.error(`Embedding generation error for doc ${documentId}: ${err?.message}`);
    }
  }
}
