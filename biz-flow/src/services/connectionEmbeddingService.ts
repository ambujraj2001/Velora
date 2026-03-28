import { supabase } from '../config/db';
import { embedText } from './embeddingService';
import { mistral } from '../config/llm';
import {
  dataIndexingPrompt,
  dataRoutingPrompt,
  routingValidationPrompt,
} from '../prompts/routing';

interface ConnectionMetadata {
  id: string;
  name: string;
  type: string;
  description?: string;
  schema_json?: any;
  [key: string]: any;
}

/**
 * ─────────────────────────────────────────────────────────
 * PART 1: CONNECTION INDEXING (LLM Generates Description)
 * ─────────────────────────────────────────────────────────
 */
export async function indexConnection(
  connection: ConnectionMetadata,
  logger: any,
  sampleRows: any[] = [],
  schemaContext: string = ''
): Promise<void> {
  try {
    logger.info('generating_high_quality_description_start', { connectionId: connection.id });

    // 1. Ask LLM to generate semantic description
    const response = await mistral.invoke(
      await dataIndexingPrompt.format({
        name: connection.name,
        type: connection.type,
        schema: schemaContext || JSON.stringify(connection.schema_json || {}),
        samples: JSON.stringify(sampleRows.slice(0, 3)),
      })
    );
    const generatedDescription = response.content.toString();

    // 2. Build index content
    const content = `
${generatedDescription.trim()}

Technical Metadata:
${schemaContext || JSON.stringify(connection.schema_json?.columns || [])}

Connection Name: ${connection.name}
Type: ${connection.type}
`.trim();

    // 3. Generate embedding
    logger.info('generating_embedding', { connectionId: connection.id });
    const embedding = await embedText(content);

    // 4. Store in DB
    const { error } = await supabase.from('velora_connection_embeddings').upsert({
      connection_id: connection.id,
      content,
      embedding,
    });

    if (error) throw error;

    // 5. Update connection description in Postgres for metadata transparency
    await supabase
      .from('velora_connections')
      .update({ description: generatedDescription.trim() })
      .eq('id', connection.id);

    logger.info('connection_fully_indexed', { connectionId: connection.id });
  } catch (err: any) {
    logger.error('indexing_failed', { error: err.message, connectionId: connection.id });
  }
}

/**
 * ─────────────────────────────────────────────────────────
 * PART 2: QUERY ROUTING (Autonomous Multi-Step Logic)
 * ─────────────────────────────────────────────────────────
 */

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

/**
 * Validates a selected connection using LLM.
 */
async function validateConnection(params: {
  query: string;
  description: string;
  logger: any;
}): Promise<{ status: 'VALID' | 'INVALID'; reason: string }> {
  const { query, description, logger } = params;
  try {
    const res = await mistral.invoke(
      await routingValidationPrompt.format({ query, description })
    );

    const json = JSON.parse(
      res.content.toString().replace(/```json/g, '').replace(/```/g, '').trim()
    );
    return json;
  } catch (err: any) {
    logger.warn('validation_call_failed_fallback_to_valid', { error: err.message });
    return { status: 'VALID', reason: 'Fallback - parsing error' };
  }
}

/**
 * Reranks candidates using LLM to pick the absolute best.
 */
async function rerankCandidates(params: {
  query: string;
  candidates: any[];
  logger: any;
}): Promise<{ connectionId: string; reason: string } | null> {
  const { query, candidates, logger } = params;
  try {
    const descriptions = candidates
      .map((c) => `ID: ${c.connection_id}\nContent: ${c.content}`)
      .join('\n\n---\n\n');

    const res = await mistral.invoke(
      await dataRoutingPrompt.format({ query, candidates: descriptions })
    );

    const json = JSON.parse(
      res.content.toString().replace(/```json/g, '').replace(/```/g, '').trim()
    );
    return json;
  } catch (err: any) {
    logger.error('rerank_call_failed', { error: err.message });
    return null;
  }
}

/**
 * THE CORE MULTI-STEP ROUTER
 */
export async function selectBestConnection(params: {
  query: string;
  userId: string;
  logger: any;
}): Promise<string | null> {
  const { query, userId, logger } = params;

  try {
    logger.info('autonomous_routing_start', { query });

    // Step 1: Embed Query (Phase 6 Embeddings)
    const queryEmbedding = await embedText(query);

    // Step 2: Fetch TOP 3 candidates using Cosine Similarity
    const { data: userConns } = await supabase.from('velora_connections').select('id').eq('user_id', userId);
    if (!userConns || userConns.length === 0) return null;
    const connIds = userConns.map((c) => c.id);

    const { data: embeddings, error } = await supabase
      .from('velora_connection_embeddings')
      .select('connection_id, embedding, content')
      .in('connection_id', connIds);

    if (error || !embeddings || embeddings.length === 0) return null;

    // Sort by similarity and take TOP 3
    const candidates = embeddings
      .map((item) => ({
        ...item,
        score: cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const similarityScores = candidates.map((c) => ({ id: c.connection_id, score: c.score }));
    logger.info('top_candidates_found', { count: candidates.length, similarityScores });

    // Step 3: LLM-BASED SELECTION (Rerank)
    const rerankResult = await rerankCandidates({ query, candidates, logger });
    if (!rerankResult) return candidates[0].score > 0.6 ? candidates[0].connection_id : null;

    // Step 4: VALIDATION GUARD (Validate with Fallback Loop)
    let bestId = rerankResult.connectionId;
    let fallbackUsed = false;
    let attempts = 0;

    while (attempts < candidates.length) {
      const selected = candidates.find((c) => c.connection_id === bestId) || candidates[attempts];
      const validation = await validateConnection({
        query,
        description: selected.content,
        logger,
      });

      logger.info('routing_validation', {
        connectionId: bestId,
        status: validation.status,
        reason: validation.reason,
      });

      if (validation.status === 'VALID') {
        // Log final resolution
        logger.info('autonomous_routing_success', {
          query,
          selectedConnectionId: bestId,
          similarityScores,
          fallbackUsed,
          validationStatus: validation.status,
        });
        return bestId;
      }

      // Fallback
      fallbackUsed = true;
      attempts++;
      if (attempts < candidates.length) {
        bestId = candidates[attempts].connection_id;
        logger.warn('routing_fallback_trigger', { nextId: bestId, attempt: attempts });
      }
    }

    logger.warn('no_valid_connection_found_after_all_fallbacks');
    return null;
  } catch (err: any) {
    logger.error('autonomous_routing_error', { error: err.message });
    return null;
  }
}
