import { randomUUID } from "node:crypto";
import { nowIso, ParsingError } from "@agent-vault/shared";
import { Chunker, DocumentParser, EmbeddingProvider, VectorStore } from "../ports/interfaces";
import { IngestRequest, IngestSummary } from "../types/requests";
import { SourceDocument } from "../domain/entities";

export type DiscoveredFile = {
  absolutePath: string;
  relativePath: string;
  fileType: SourceDocument["fileType"];
  checksum: string;
};

export class IngestService {
  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === "object") {
      const message =
        "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : null;
      const details =
        "details" in error && typeof (error as { details?: unknown }).details === "string"
          ? (error as { details: string }).details
          : null;
      const hint =
        "hint" in error && typeof (error as { hint?: unknown }).hint === "string"
          ? (error as { hint: string }).hint
          : null;
      return [message, details, hint].filter(Boolean).join(" | ") || JSON.stringify(error);
    }
    return String(error);
  }

  constructor(
    private readonly dependencies: {
      discoverFiles: (sourcePath: string, includeImages: boolean) => Promise<DiscoveredFile[]>;
      parserFactory: { forPath(filePath: string): DocumentParser | null };
      chunker: Chunker;
      embeddingProvider: EmbeddingProvider;
      vectorStore: VectorStore;
    },
  ) {}

  async ingest(request: IngestRequest): Promise<IngestSummary> {
    const jobId = randomUUID();
    await this.dependencies.vectorStore.createIngestionJob({
      id: jobId,
      projectId: request.projectId,
      sourcePath: request.sourcePath,
      status: "running",
      stats: {},
      startedAt: nowIso(),
    });

    const discovered = await this.dependencies.discoverFiles(
      request.sourcePath,
      Boolean(request.includeImages),
    );

    let parsed = 0;
    let skipped = 0;
    let chunkCount = 0;
    const total = discovered.length;
    const emit = request.onProgress;

    emit?.({ phase: "scanning", current: 0, total, filePath: "", parsed, skipped, chunks: chunkCount });

    try {
      for (let idx = 0; idx < discovered.length; idx++) {
        const file = discovered[idx]!;
        const existing = await this.dependencies.vectorStore.findByProjectAndPath(
          request.projectId,
          file.relativePath,
        );

        if (!request.reindex && existing && existing.checksum === file.checksum) {
          skipped++;
          emit?.({ phase: "processing", current: idx + 1, total, filePath: file.relativePath, parsed, skipped, chunks: chunkCount });
          continue;
        }

        const documentId = randomUUID();
        const parser = this.dependencies.parserFactory.forPath(file.absolutePath);
        if (!parser) {
          skipped++;
          emit?.({ phase: "processing", current: idx + 1, total, filePath: file.relativePath, parsed, skipped, chunks: chunkCount });
          continue;
        }

        const assets = await parser.parse(file.absolutePath, documentId);
        if (assets.length === 0) {
          skipped++;
          emit?.({ phase: "processing", current: idx + 1, total, filePath: file.relativePath, parsed, skipped, chunks: chunkCount });
          continue;
        }

        parsed++;

        const metadata = {
          projectId: request.projectId,
          path: file.relativePath,
          fileType: file.fileType,
          checksum: file.checksum,
          ingestedAt: nowIso(),
        };

        const chunks = await this.dependencies.chunker.chunk({
          assets,
          embeddingModel: this.dependencies.embeddingProvider.model(),
          metadata,
          documentId,
        });

        if (chunks.length === 0) {
          skipped++;
          emit?.({ phase: "processing", current: idx + 1, total, filePath: file.relativePath, parsed, skipped, chunks: chunkCount });
          continue;
        }

        const embeddings = await this.dependencies.embeddingProvider.embed(
          chunks.map((chunk) => chunk.content),
        );

        for (let i = 0; i < chunks.length; i++) {
          chunks[i]!.embedding = embeddings[i] ?? [];
        }

        const now = nowIso();
        const document: SourceDocument = {
          id: documentId,
          projectId: request.projectId,
          path: file.relativePath,
          fileType: file.fileType,
          checksum: file.checksum,
          metadata,
          createdAt: now,
          updatedAt: now,
        };

        if (!request.dryRun) {
          await this.dependencies.vectorStore.deleteByProjectAndPath(request.projectId, file.relativePath);
          await this.dependencies.vectorStore.upsertDocuments([document]);
          await this.dependencies.vectorStore.upsertChunks(chunks);
        }

        chunkCount += chunks.length;
        emit?.({ phase: "processing", current: idx + 1, total, filePath: file.relativePath, parsed, skipped, chunks: chunkCount });
      }

      emit?.({ phase: "done", current: total, total, filePath: "", parsed, skipped, chunks: chunkCount });

      const stats = {
        scanned: discovered.length,
        parsed,
        skipped,
        chunks: chunkCount,
      };

      await this.dependencies.vectorStore.finishIngestionJob(jobId, "completed", stats);

      return {
        projectId: request.projectId,
        scanned: discovered.length,
        parsed,
        skipped,
        chunks: chunkCount,
        persisted: !request.dryRun,
        jobId,
        embeddingModel: this.dependencies.embeddingProvider.model(),
      };
    } catch (error) {
      const message = this.errorMessage(error);
      await this.dependencies.vectorStore.finishIngestionJob(jobId, "failed", {
        error: message,
      });
      throw new ParsingError(message || "Ingest failed");
    }
  }
}
