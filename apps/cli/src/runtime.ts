import fs from "node:fs";
import path from "node:path";
import { AskService, ConfigureService, ConversationLogService, DoctorService, IngestService, StatusService } from "@agents-vault/core";
import {
  DefaultChunker,
  discoverSourceFiles,
  ImageParser,
  ParserFactory,
  PdfParser,
  TextParser,
} from "@agents-vault/ingestion";
import { createAnswerProvider, createEmbeddingProvider, StubOcrProvider, StubVisionCaptionProvider } from "@agents-vault/providers";
import { reduceContextByScore, rrfRerank } from "@agents-vault/retrieval";
import {
  ConfigError,
  modelConfigurationSchema,
  resolveConfigPath,
  resolveDbPath,
  resolveDefaultProject,
  resolveOutputDir,
} from "@agents-vault/shared";
import { LocalConfigRepository, MarkdownConversationExporter, SqliteVectorStore } from "@agents-vault/storage";

export function createRuntime(cwd: string) {
  let bootstrapConfigPath = resolveConfigPath();
  if (!fs.existsSync(bootstrapConfigPath)) {
    const legacyPath = path.join(process.env.HOME || "", ".agents-vault", "config.json");
    if (legacyPath && fs.existsSync(legacyPath)) {
      bootstrapConfigPath = legacyPath;
    }
  }

  let bootstrapConfig: ReturnType<typeof modelConfigurationSchema.parse> | null = null;
  try {
    const raw = fs.readFileSync(bootstrapConfigPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = modelConfigurationSchema.safeParse(parsed);
    bootstrapConfig = result.success ? result.data : null;
  } catch {
    bootstrapConfig = null;
  }

  const configRepository = new LocalConfigRepository();

  const parserFactory = new ParserFactory([
    new TextParser(),
    new PdfParser(),
    new ImageParser(new StubOcrProvider(), new StubVisionCaptionProvider()),
  ]);

  const configureService = new ConfigureService(configRepository);
  let vectorStore: SqliteVectorStore | null = null;

  function getVectorStore(): SqliteVectorStore {
    if (vectorStore) {
      return vectorStore;
    }
    try {
      vectorStore = new SqliteVectorStore(bootstrapConfig?.dbPath);
    } catch {
      vectorStore = new SqliteVectorStore(resolveDbPath(cwd));
    }
    return vectorStore;
  }

  async function createIngestService() {
    const config = await configRepository.load();
    if (!config) {
      throw new ConfigError("No configuration found. Run `agents-vault configure` before ingest.");
    }

    return new IngestService({
      discoverFiles: discoverSourceFiles,
      parserFactory,
      chunker: new DefaultChunker(),
      embeddingProvider: createEmbeddingProvider(config),
      vectorStore: getVectorStore(),
    });
  }

  function createAskService(outputDir?: string) {
    const exporter = new MarkdownConversationExporter(
      outputDir ?? bootstrapConfig?.outputDir ?? resolveOutputDir(cwd),
    );
    const conversationLogService = new ConversationLogService(exporter);

    return new AskService({
      configRepository,
      vectorStore: getVectorStore(),
      conversationLogService,
      embeddingProviderFactory: createEmbeddingProvider,
      answerProviderFactory: createAnswerProvider,
      reduceContext: reduceContextByScore,
      rerank: rrfRerank,
    });
  }

  function createStatusService() {
    return new StatusService(configRepository, getVectorStore());
  }

  function createDoctorService() {
    return new DoctorService(configRepository, getVectorStore());
  }

  return {
    configRepository,
    createIngestService,
    createAskService,
    createStatusService,
    createDoctorService,
    getVectorStore,
    configureService,
    resolvedOutputDir: bootstrapConfig?.outputDir ?? resolveOutputDir(cwd),
    resolvedConfigPath: resolveConfigPath(),
    resolvedDefaultProject: bootstrapConfig?.defaultProject ?? resolveDefaultProject(cwd),
  };
}
