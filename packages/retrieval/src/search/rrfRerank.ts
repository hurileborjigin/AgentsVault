/**
 * Reciprocal Rank Fusion (RRF) reranker.
 *
 * Fuses vector and BM25 rankings using rank-based scores,
 * avoiding issues with incomparable score distributions.
 */
export function rrfRerank<
  T extends { score: number; metadata: Record<string, unknown> },
>(items: T[], opts?: { k?: number }): T[] {
  if (items.length === 0) return items;

  const k = opts?.k ?? 60;
  const n = items.length;

  // Assign vector ranks (1-based, lower = better)
  const byVector = items
    .map((item, idx) => ({ idx, score: (item.metadata.vectorScore as number) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const vectorRank = new Map<number, number>();
  byVector.forEach((entry, rank) => vectorRank.set(entry.idx, rank + 1));

  // Assign BM25 ranks (items without BM25 score get rank = n + 1)
  const byBm25 = items
    .map((item, idx) => ({
      idx,
      score: (item.metadata.bm25Score as number) ?? -1,
      hasBm25: item.metadata.bm25Score !== undefined,
    }))
    .sort((a, b) => b.score - a.score);
  const bm25Rank = new Map<number, number>();
  let rank = 1;
  for (const entry of byBm25) {
    bm25Rank.set(entry.idx, entry.hasBm25 ? rank++ : n + 1);
  }

  // Compute RRF score and update items
  const scored = items.map((item, idx) => {
    const vr = vectorRank.get(idx)!;
    const br = bm25Rank.get(idx)!;
    const rrfScore = 1 / (k + vr) + 1 / (k + br);
    return { item, rrfScore };
  });

  scored.sort((a, b) => b.rrfScore - a.rrfScore);

  return scored.map(({ item, rrfScore }) => ({
    ...item,
    score: rrfScore,
  }));
}
