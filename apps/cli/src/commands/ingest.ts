import { Command } from "commander";
import { IngestService } from "@agent-vault/core";
import { header, info, success, warn, divider, label, ProgressRenderer } from "../ui";
import type { IngestProgress } from "@agent-vault/core";

export function registerIngestCommand(
  program: Command,
  ingestServiceFactory: () => Promise<IngestService>,
  defaultProject: string,
) {
  program
    .command("ingest")
    .description("Ingest documents into local SQLite vector index")
    .requiredOption("--source <path>", "Source directory")
    .option("--project <id>", "Project namespace")
    .option("--reindex", "Force reindex even when checksum is unchanged", false)
    .option("--dry-run", "Run ingestion without persisting data", false)
    .option("--include-images", "Include image files and use stub parser", false)
    .action(async (options) => {
      try {
        const ingestService = await ingestServiceFactory();
        const progress = new ProgressRenderer();
        progress.start();
        const onProgress = (p: IngestProgress) => {
          progress.update(p);
        };
        const summary = await ingestService.ingest({
          sourcePath: options.source,
          projectId: options.project || defaultProject,
          reindex: options.reindex,
          dryRun: options.dryRun,
          includeImages: options.includeImages,
          onProgress,
        });
        progress.stop();

        console.log();
        console.log(header(summary.persisted ? "Ingestion Complete" : "Dry Run Complete"));
        console.log(divider());
        console.log(info("project", summary.projectId));
        console.log(info("embedding model", summary.embeddingModel));
        console.log(info("source", options.source));
        console.log();
        console.log(info("scanned", summary.scanned));
        console.log(success(`parsed ${summary.parsed}`));
        if (summary.skipped > 0) {
          console.log(warn(`skipped ${summary.skipped}`));
        } else {
          console.log(info("skipped", summary.skipped));
        }
        console.log(info("chunks", summary.chunks));
        console.log();
        console.log(label(`job_id: ${summary.jobId}`));
      } catch (error) {
        console.error(`ingest failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
