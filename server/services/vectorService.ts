import { multiAIService } from "./multiAIService";

export async function generateEmbeddings(text: string): Promise<number[]> {
  return await multiAIService.generateEmbeddings(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchSimilarChunks(
  query: string,
  chunks: Array<{ id: string; embedding: number[]; content: string; documentId: string }>,
  topK: number = 5
): Promise<Array<{
  id: string;
  content: string;
  documentId: string;
  similarity: number;
}>> {
  const queryEmbedding = await generateEmbeddings(query);
  
  const similarities = chunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(({ embedding, ...rest }) => rest);
}
