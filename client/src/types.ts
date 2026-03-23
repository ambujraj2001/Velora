export type FragmentType = 'md' | 'table' | 'chart' | 'list' | 'code' | 'dashboard' | 'error';

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
  rows: Record<string, unknown>[];
}>;
export type ChartFragment = BaseFragment<{ highchartOptions: Record<string, unknown> }>;
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

export interface GraphState {
  userInput: string;
  intent?: 'CHAT' | 'DATA_QUERY' | 'DASHBOARD';
  sql?: string;
  rows?: Record<string, unknown>[];
  error?: string;
  retryCount: number;
  fragments: AnyFragment[];
  dashboardPlan?: {
    layout?: string;
    charts?: Array<{
      type: string;
      description: string;
    }>;
  };
  connectionId?: string;
  conversationId?: string;
  connectionType?: 'postgres' | 'clickhouse';
  schemaContext?: string;
}
