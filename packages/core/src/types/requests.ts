import { ModelConfiguration } from "@agent-vault/shared";

export type IngestProgress = {
  phase: "scanning" | "processing" | "done";
  current: number;
  total: number;
  filePath: string;
  parsed: number;
  skipped: number;
  chunks: number;
};

export type IngestRequest = {
  sourcePath: string;
  projectId: string;
  reindex?: boolean;
  dryRun?: boolean;
  includeImages?: boolean;
  onProgress?: (progress: IngestProgress) => void;
};

export type IngestSummary = {
  projectId: string;
  scanned: number;
  parsed: number;
  skipped: number;
  chunks: number;
  persisted: boolean;
  jobId: string;
  embeddingModel: string;
};

export type AskRequest = {
  question: string;
  projectId: string;
  topK?: number;
  outputDir?: string;
};

export type AskSummary = {
  answer: string;
  citations: number;
  outputPath: string;
  retrieved: number;
  provider: string;
  answerModel: string;
  embeddingModel: string;
};

export type ConfigureRequest = {
  provider: ModelConfiguration["provider"];
  answerModel: string;
  azureDeployment?: string;
  outputDir: string;
  dbPath: string;
  defaultProject?: string;
};
