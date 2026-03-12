export type FileType = "pdf" | "txt" | "md" | "image";
export type Modality = "text" | "ocr-text" | "image-caption";

export type ProjectNamespace = {
  id: string;
};

export type SourceDocument = {
  id: string;
  projectId: string;
  path: string;
  fileType: FileType;
  checksum: string;
  title?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ParsedAsset = {
  documentId: string;
  modality: Modality;
  content: string;
  metadata: Record<string, unknown>;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  modality: Modality;
  content: string;
  tokenCount?: number;
  embeddingModel: string;
  embedding: number[];
  metadata: Record<string, unknown>;
};

export type Citation = {
  documentPath: string;
  chunkId: string;
  excerpt: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type IngestionJob = {
  id: string;
  projectId: string;
  sourcePath: string;
  status: "running" | "completed" | "failed";
  stats: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
};

export type QueryLog = {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  createdAt: string;
  outputPath: string;
  provider: "openai" | "azure-openai" | "ollama";
  model: string;
  embeddingModel: string;
  project: string;
  topK: number;
  retrievedContext: Array<{
    documentPath: string;
    chunkId: string;
    score: number;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type AnswerRecord = {
  answer: string;
  citations: Citation[];
};
