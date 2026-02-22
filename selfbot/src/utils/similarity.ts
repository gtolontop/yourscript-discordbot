/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find top-K most similar items from a collection
 */
export function topKSimilar(
  queryEmbedding: number[],
  items: Array<{ embedding: number[]; data: any }>,
  k: number = 5,
  threshold: number = 0.7
): Array<{ similarity: number; data: any }> {
  const scored = items
    .map((item) => ({
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
      data: item.data,
    }))
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, k);
}
