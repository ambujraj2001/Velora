const TOOL_LABELS: Record<string, string> = {
  sql_query: 'Running SQL query',
  csv_query: 'Querying CSV data',
  chat_response: 'Writing response',
  dashboard_builder: 'Building dashboard',
  schema_lookup: 'Looking up schema',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? `Running ${tool.replace(/_/g, ' ')}`;
}
