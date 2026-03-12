import { ModelConfiguration } from "@agent-vault/shared";
import {
  Citation,
  DocumentChunk,
  IngestionJob,
  ParsedAsset,
  QueryLog,
  SourceDocument,
} from "../domain/entities";

export type SearchOptions = {
  projectId: string;
  topK: number;
  fileTypes?: Array<"pdf" | "txt" | "md" | "image">;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentPath: string;
  chunkIndex: number;
  modality: "text" | "ocr-text" | "image-caption";
  content: string;
  score: number;
  metadata: Record<string, unknown>;
};

export interface VectorStore {
  upsertDocuments(docs: SourceDocument[]): Promise<void>;
  upsertChunks(chunks: DocumentChunk[]): Promise<void>;
  search(queryEmbedding: number[], opts: SearchOptions): Promise<RetrievedChunk[]>;
  deleteByProjectAndPath(projectId: string, path: string): Promise<void>;
  findByProjectAndPath(projectId: string, path: string): Promise<SourceDocument | null>;
  createIngestionJob(job: IngestionJob): Promise<void>;
  finishIngestionJob(jobId: string, status: "completed" | "failed", stats: Record<string, unknown>): Promise<void>;
  getProjectStats(projectId?: string): Promise<{ documents: number; chunks: number; lastIngestionAt: string | null }>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}

export interface DocumentParser {
  supports(filePath: string): boolean;
  parse(filePath: string, documentId: string): Promise<ParsedAsset[]>;
}

export interface Chunker {
  chunk(input: {
    assets: ParsedAsset[];
    embeddingModel: string;
    metadata: Record<string, unknown>;
    documentId: string;
  }): Promise<DocumentChunk[]>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  model(): string;
  dimensions(): number;
}

export interface AnswerProvider {
  answer(input: {
    question: string;
    context: RetrievedChunk[];
    instructions?: string;
  }): Promise<{
    answer: string;
    citations: Citation[];
  }>;
  model(): string;
}

export interface ConfigRepository {
  load(): Promise<ModelConfiguration | null>;
  save(config: ModelConfiguration): Promise<void>;
}

export interface ConversationExporter {
  export(record: QueryLog): Promise<string>;
}
