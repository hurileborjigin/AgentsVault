import { Command } from "commander";
import { DoctorService } from "@agent-vault/core";
import { header, success, fail, divider } from "../ui";

export function registerDoctorCommand(program: Command, doctorServiceFactory: () => DoctorService) {
  program
    .command("doctor")
    .description("Validate environment, configuration and storage readiness")
    .action(async () => {
      try {
        const doctorService = doctorServiceFactory();
        const checks = await doctorService.run();

        console.log();
        console.log(header("Doctor"));
        console.log(divider());
        for (const check of checks) {
          console.log(check.ok ? success(`${check.name}: ${check.message}`) : fail(`${check.name}: ${check.message}`));
        }

        if (checks.some((check) => !check.ok)) {
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(`doctor failed: ${error instanceof Error ? error.message : "unknown error"}`);
        process.exitCode = 1;
      }
    });
}
