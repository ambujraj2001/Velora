import type { Tool } from './types';
import { schemaLookupTool } from './schemaLookup';
import { sqlQueryTool } from './sqlQuery';
import { csvQueryTool } from './csvQuery';
import { chatResponseTool } from './chatResponse';
import { dashboardBuilderTool } from './dashboardBuilder';

export const toolRegistry: Record<string, Tool> = {
  [schemaLookupTool.name]: schemaLookupTool,
  [sqlQueryTool.name]: sqlQueryTool,
  [csvQueryTool.name]: csvQueryTool,
  [chatResponseTool.name]: chatResponseTool,
  [dashboardBuilderTool.name]: dashboardBuilderTool,
};
