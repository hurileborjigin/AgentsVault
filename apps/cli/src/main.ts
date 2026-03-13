import chalk from "chalk";
import { Command } from "commander";
import { registerConfigureCommand } from "./commands/configure";
import { registerIngestCommand } from "./commands/ingest";
import { registerAskCommand } from "./commands/ask";
import { registerStatusCommand } from "./commands/status";
import { registerDoctorCommand } from "./commands/doctor";
import { registerDeleteCommand } from "./commands/delete";
import { registerListCommand } from "./commands/list";
import { createRuntime } from "./runtime";

export function createProgram(cwd: string) {
  const runtime = createRuntime(cwd);

  const program = new Command();
  program
    .name("agents-vault")
    .description("CLI-first retrieval system for coding agents")
    .version("1.0.0")
    .addHelpText(
      "after",
      `
${chalk.bold.cyan("Quick Start:")}
  ${chalk.dim("$")} agents-vault configure
  ${chalk.dim("$")} agents-vault ingest --source ./docs --project my-project
  ${chalk.dim("$")} agents-vault ask "How does auth work?" --project my-project

${chalk.bold.cyan("Common Flags:")}
  ${chalk.white("ingest:")} --source <path> --project <id> [--reindex] [--dry-run] [--include-images]
  ${chalk.white("ask:")}    <question> --project <id> [--top-k <n>] [--out <path>] [--format md]
`,
    );

  registerConfigureCommand(program, runtime.configureService);
  registerIngestCommand(program, runtime.createIngestService, runtime.resolvedDefaultProject);
  registerAskCommand(program, runtime.createAskService, runtime.resolvedDefaultProject);
  registerStatusCommand(program, runtime.createStatusService, runtime.resolvedDefaultProject);
  registerDoctorCommand(program, runtime.createDoctorService);
  registerDeleteCommand(program, runtime.getVectorStore);
  registerListCommand(program, runtime.createStatusService);

  return program;
}
