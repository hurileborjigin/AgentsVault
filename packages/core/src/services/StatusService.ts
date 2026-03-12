import { ConfigRepository, VectorStore } from "../ports/interfaces";

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "Unknown status error";
}

export class StatusService {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly vectorStore: VectorStore,
  ) {}

  async getStatus(projectId?: string) {
    const config = await this.configRepository.load();
    let stats = { documents: 0, chunks: 0, lastIngestionAt: null as string | null };
    let statsError: string | null = null;

    try {
      stats = await this.vectorStore.getProjectStats(projectId);
    } catch (error) {
      statsError = messageFromUnknown(error);
    }

    const health = await this.vectorStore.healthCheck();
    const storageOk = health.ok && !statsError;
    const detailParts = [health.detail];
    if (statsError) {
      detailParts.push(`Stats query failed: ${statsError}`);
    }

    return {
      configured: Boolean(config),
      provider: config?.provider ?? null,
      answerModel: config?.answerModel ?? null,
      embeddingModel: config?.embeddingModel ?? null,
      project: projectId ?? config?.defaultProject ?? null,
      documents: stats.documents,
      chunks: stats.chunks,
      lastIngestionAt: stats.lastIngestionAt,
      storageOk,
      storageDetail: detailParts.join(" | "),
    };
  }
}
