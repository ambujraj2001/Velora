import { MistralAIEmbeddings } from '@langchain/mistralai';
import dotenv from 'dotenv';
dotenv.config();

const embeddings = new MistralAIEmbeddings({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: 'mistral-embed',
});

/**
 * Pure utility to generate embeddings for a given text using Mistral.
 * Note: Mistral generates 1024 dimensions. If the database expects 1536,
 * we pad with zeros to ensure compatibility while maintaining semantic search.
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await embeddings.embedQuery(text);
  
  // Padding to 1536 if necessary (for legacy table compatibility)
  if (result.length === 1024) {
    const padded = new Array(1536).fill(0);
    for (let i = 0; i < 1024; i++) {
      padded[i] = result[i];
    }
    return padded;
  }
  
  return result;
}
