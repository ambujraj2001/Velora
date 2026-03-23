export type FragmentType = 'md' | 'table' | 'chart' | 'list' | 'code' | 'dashboard' | 'error';

export type ConnectionType = 'postgres' | 'clickhouse';

export type BaseFragment<T> = {
  id: string;
  name?: string;
  type: FragmentType;
  data: T;
  meta?: {
    order?: number;
    loading?: boolean;
  };
};

export type MarkdownFragment = BaseFragment<{ content: string }>;
export type TableFragment = BaseFragment<{
  columns: string[];
  rows: Record<string, any>[];
}>;
export type ChartFragment = BaseFragment<{ highchartOptions: object }>;
export type CodeFragment = BaseFragment<{ language: string; code: string }>;
export type DashboardFragment = BaseFragment<{
  layout?: string;
  fragments: AnyFragment[];
}>;
export type ErrorFragment = BaseFragment<{ message: string }>;

export type AnyFragment =
  | MarkdownFragment
  | TableFragment
  | ChartFragment
  | CodeFragment
  | DashboardFragment
  | ErrorFragment;

export type IntentData = 'CHAT' | 'DATA_QUERY' | 'DASHBOARD';

export interface GraphState {
  userInput: string;
  intent?: IntentData;
  sql?: string;
  rows?: any[];
  error?: string;
  retryCount: number;
  fragments: AnyFragment[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  dashboardPlan?: {
    title: string;
    charts: Array<{
      type: string;
      description: string;
    }>;
  };
  connectionId?: string;
  conversationId?: string;
  connectionType?: ConnectionType;
  schemaContext?: string;
  connectionSettings?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  };
}
