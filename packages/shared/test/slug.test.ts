import { describe, expect, it } from "vitest";
import { slugifyQuestion } from "../src";

describe("slugifyQuestion", () => {
  it("creates deterministic slug", () => {
    expect(slugifyQuestion("How does auth work?"))
      .toBe("how-does-auth-work");
  });
});
