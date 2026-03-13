import { Command } from "commander";
import { VectorStore } from "@agents-vault/core";
import { header, info, success, warn, divider } from "../ui";

export function registerDeleteCommand(
  program: Command,
  vectorStoreFactory: () => VectorStore,
) {
  program
    .command("delete <project>")
    .description("Delete an indexed project and all its data")
    .option("--yes", "Skip confirmation")
    .action(async (project: string, options) => {
      try {
        const vectorStore = vectorStoreFactory();
        const stats = await vectorStore.getProjectStats(project);

        if (stats.documents === 0) {
          console.log(warn(`No project found with id "${project}".`));
          return;
        }

        if (!options.yes) {
          console.log();
          console.log(header("Delete Project"));
          console.log(divider());
          console.log(info("project", project));
          console.log(info("documents", stats.documents));
          console.log(info("chunks", stats.chunks));
          console.log();

          const readline = await import("node:readline");
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) => {
            rl.question("Are you sure? (y/N) ", resolve);
          });
          rl.close();

          if (answer.toLowerCase() !== "y") {
            console.log("Cancelled.");
            return;
          }
        }

        const result = await vectorStore.deleteProject(project);
        console.log();
        console.log(success(`Deleted project "${project}": ${result.documents} documents, ${result.chunks} chunks removed.`));
      } catch (error) {
        console.error(`delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
