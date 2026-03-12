import { Command } from "commander";
import { StatusService } from "@agents-vault/core";
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
    .option("--list-projects", "List all indexed projects")
    .action(async (options) => {
      try {
        const statusService = statusServiceFactory();

        if (options.listProjects) {
          const projects = await statusService.listProjects();
          if (projects.length === 0) {
            console.log("\nNo projects found. Run `agents-vault ingest` first.\n");
            return;
          }
          console.log();
          console.log(header("Projects"));
          console.log(divider());
          for (const p of projects) {
            console.log(info(p.projectId, `${p.documents} docs, ${p.chunks} chunks`));
          }
          console.log();
          return;
        }
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
