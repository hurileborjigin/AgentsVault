import { describe, expect, it } from "vitest";
import { createProgram } from "../src/main";

describe("cli program", () => {
  it("registers required commands", () => {
    process.env.OPENAI_API_KEY = "test-key";

    const program = createProgram(process.cwd());
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(
      expect.arrayContaining(["configure", "ingest", "ask", "status", "doctor"]),
    );
  });
});
