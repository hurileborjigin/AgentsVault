import { Command } from "commander";
import { StatusService } from "@agents-vault/core";
import { header, info, divider } from "../ui";

export function registerListCommand(
  program: Command,
  statusServiceFactory: () => StatusService,
) {
  program
    .command("list")
    .description("List all indexed projects")
    .action(async () => {
      try {
        const statusService = statusServiceFactory();
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
      } catch (error) {
        console.error(`list failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
