import type { Tool } from './types';
import { schemaLookupTool } from './schemaLookup';
import { sqlQueryTool } from './sqlQuery';
import { chatResponseTool } from './chatResponse';
import { dashboardBuilderTool } from './dashboardBuilder';

export const toolRegistry: Record<string, Tool> = {
  [schemaLookupTool.name]: schemaLookupTool,
  [sqlQueryTool.name]: sqlQueryTool,
  [chatResponseTool.name]: chatResponseTool,
  [dashboardBuilderTool.name]: dashboardBuilderTool,
};
