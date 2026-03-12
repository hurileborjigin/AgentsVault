import { describe, expect, it } from "vitest";
import { reduceContextByScore } from "../src/search/contextReducer";

describe("reduceContextByScore", () => {
  it("returns top items sorted by score descending", () => {
    const items = [
      { score: 0.5, id: "c" },
      { score: 0.9, id: "a" },
      { score: 0.7, id: "b" },
      { score: 0.3, id: "d" },
    ];

    const result = reduceContextByScore(items, 2);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("a");
    expect(result[1]!.id).toBe("b");
  });

  it("returns all items when maxItems exceeds length", () => {
    const items = [{ score: 0.5 }, { score: 0.9 }];
    const result = reduceContextByScore(items, 10);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(reduceContextByScore([], 5)).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const items = [{ score: 0.3 }, { score: 0.9 }, { score: 0.6 }];
    reduceContextByScore(items, 2);
    expect(items[0]!.score).toBe(0.3);
  });
});
