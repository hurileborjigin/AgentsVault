#!/usr/bin/env node

async function run() {
  const { AuthVault } = await import("@agent-vault/storage");
  const authVault = new AuthVault();
  await authVault.loadIntoEnv();
  const { createProgram } = await import("./main");
  const program = createProgram(process.cwd());
  await program.parseAsync(process.argv);
}

run().catch(async (error) => {
  const chalk = (await import("chalk")).default;
  console.error(chalk.red(`fatal: ${error instanceof Error ? error.message : "unknown error"}`));
  process.exit(1);
});
