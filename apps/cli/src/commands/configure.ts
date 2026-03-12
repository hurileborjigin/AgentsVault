import { Command } from "commander";
import { ConfigureService } from "@agent-vault/core";
import { resolveDbPath, resolveDefaultProject, resolveOutputDir } from "@agent-vault/shared";
import { runConfigurePrompt } from "../prompts/configurePrompt";
import { LocalConfigRepository } from "@agent-vault/storage";
import { success, label } from "../ui";

export function registerConfigureCommand(program: Command, configureService: ConfigureService) {
  program
    .command("configure")
    .description("Interactively configure provider and models")
    .action(async () => {
      try {
        const repo = new LocalConfigRepository();
        const existing = await repo.load();
        const selection = await runConfigurePrompt();
        await configureService.configure({
          ...selection,
          outputDir: existing?.outputDir ?? resolveOutputDir(process.cwd()),
          dbPath: existing?.dbPath ?? resolveDbPath(process.cwd()),
          defaultProject: existing?.defaultProject ?? resolveDefaultProject(process.cwd()),
        });
        console.log();
        console.log(success(`Configuration saved to ${repo.getPath()}`));
        console.log(label("Note: API credentials are read from shell environment variables and are not stored in config."));
      } catch (error) {
        console.error(`configure failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
