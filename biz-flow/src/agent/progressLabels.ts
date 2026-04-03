/**
 * Exact agent step label for progress UI (no vague copy): graph node id + tool name.
 */
export function formatAgentStepLabel(stepId: string, tool: string): string {
  return `${stepId} · ${tool}`;
}
