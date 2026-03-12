import { Command } from "commander";
import { StatusService } from "@agent-vault/core";
import { header, info, success, fail, divider } from "../ui";

export function registerStatusCommand(
  program: Command,
  statusServiceFactory: () => StatusService,
  defaultProject: string,
) {
  program
    .command("status")
    .description("Show configuration, indexing and local storage status")
    .option("--project <id>", "Project namespace")
    .action(async (options) => {
      try {
        const statusService = statusServiceFactory();
        const status = await statusService.getStatus(options.project || defaultProject);

        console.log();
        console.log(header("Status"));
        console.log(divider());
        console.log(status.configured ? success("configured") : fail("not configured"));
        console.log(info("provider", status.provider ?? "none"));
        console.log(info("answer model", status.answerModel ?? "none"));
        console.log(info("embedding model", status.embeddingModel ?? "none"));
        console.log(info("project", status.project ?? "none"));
        console.log();
        console.log(info("documents", status.documents));
        console.log(info("chunks", status.chunks));
        console.log(info("last ingestion", status.lastIngestionAt ?? "none"));
        console.log();
        console.log(
          status.storageOk
            ? success(`storage: ${status.storageDetail}`)
            : fail(`storage: ${status.storageDetail}`),
        );
      } catch (error) {
        console.error(`status failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
