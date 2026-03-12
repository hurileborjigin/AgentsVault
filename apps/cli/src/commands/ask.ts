import { Command } from "commander";
import { AskService } from "@agent-vault/core";
import { header, info, divider, label } from "../ui";

export function registerAskCommand(
  program: Command,
  askServiceFactory: (outputDir?: string) => AskService,
  defaultProject: string,
) {
  program
    .command("ask")
    .description("Ask a one-shot grounded question from indexed project knowledge")
    .argument("<question>", "Question to answer")
    .option("--project <id>", "Project namespace")
    .option("--top-k <n>", "Final context size (1-8)", (value) => Number(value), 8)
    .option("--out <path>", "Output directory override")
    .option("--format <format>", "Output format", "md")
    .action(async (question: string, options) => {
      try {
        if (options.format !== "md") {
          throw new Error("Only markdown output format is supported in v1.");
        }

        const askService = askServiceFactory(options.out);
        const summary = await askService.ask({
          question,
          projectId: options.project || defaultProject,
          topK: options.topK,
          outputDir: options.out,
        });

        console.log();
        console.log(header(`${summary.provider} / ${summary.answerModel}`));
        console.log(divider());
        console.log(info("embedding model", summary.embeddingModel));
        console.log(info("project", options.project || defaultProject));
        console.log(info("top-k", options.topK));
        console.log();
        console.log(summary.answer);
        console.log();
        console.log(divider());
        console.log(info("citations", summary.citations));
        console.log(info("retrieved chunks", summary.retrieved));
        console.log(label(`saved_to: ${summary.outputPath}`));
      } catch (error) {
        console.error(`ask failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
