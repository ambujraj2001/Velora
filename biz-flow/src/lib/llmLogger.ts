import { mistral } from '../config/llm';
import type { ContextLogger } from './logger';

interface LLMUsageOpts {
  logger: ContextLogger;
  model?: string;
  stepId?: string;
  tool?: string;
}

function extractTokens(response: any): {
  inputTokens: number;
  outputTokens: number;
} {
  const um = response.usage_metadata;
  if (um) {
    return {
      inputTokens: um.input_tokens || 0,
      outputTokens: um.output_tokens || 0,
    };
  }

  const tu = response.response_metadata?.token_usage;
  if (tu) {
    return {
      inputTokens: tu.prompt_tokens || 0,
      outputTokens: tu.completion_tokens || 0,
    };
  }

  const content = response.content?.toString() || '';
  return {
    inputTokens: 0,
    outputTokens: Math.ceil(content.length / 4),
  };
}

export async function invokeWithLogging(
  messages: [string, string][],
  opts: LLMUsageOpts,
) {
  const model = opts.model || 'mistral';
  const start = Date.now();

  opts.logger.info('llm_call_start', {
    model,
    tool: opts.tool,
    stepId: opts.stepId,
  });

  const response = await mistral.invoke(messages);
  const durationMs = Date.now() - start;
  const { inputTokens, outputTokens } = extractTokens(response);

  opts.logger.info('llm_usage', {
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    durationMs,
    tool: opts.tool,
    stepId: opts.stepId,
  });

  return response;
}
