import {
  ArrowRight,
  Bot,
  Braces,
  ChartColumnBig,
  Database,
  LayoutDashboard,
  MessageSquareText,
  RefreshCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type Step = {
  title: string;
  description: string;
};

export const navLinks = [
  { label: 'Product', href: '#solution' },
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Developers', href: '#developers' },
];

export const painPoints = [
  'SQL expertise becomes the gatekeeper to answers.',
  'Traditional dashboards freeze your team into rigid views.',
  'Data teams get buried in one-off requests and follow-ups.',
  'By the time insights arrive, the moment to act has passed.',
];

export const solutionPoints = [
  'Ask in plain English and keep the conversation moving.',
  'Velora writes, retries, and improves SQL automatically.',
  'Results arrive as polished tables, charts, and dashboards.',
  'Every useful answer can be turned into a reusable workspace.',
];

export const solutionFeatures: Feature[] = [
  {
    title: 'Ask in plain English',
    description: 'No complex syntax. Just describe what you need to know.',
    icon: MessageSquareText,
  },
  {
    title: 'AI writes and improves SQL automatically',
    description: 'Self-correcting queries that get smarter with every interaction.',
    icon: Braces,
  },
  {
    title: 'Results arrive as polished tables and dashboards',
    description: 'Beautiful, interactive visualizations generated in real time.',
    icon: ChartColumnBig,
  },
  {
    title: 'Turn any answer into a reusable workspace',
    description: 'Collaborate with your team instantly on any discovered insight.',
    icon: LayoutDashboard,
  },
];

export const features: Feature[] = [
  {
    title: 'Natural Language Queries',
    description: 'Explore metrics the same way you talk to your team, without memorizing schemas or syntax.',
    icon: MessageSquareText,
  },
  {
    title: 'Automatic SQL Generation',
    description: 'Velora generates auditable SQL on the fly and adapts it to the structure of your warehouse.',
    icon: Braces,
  },
  {
    title: 'Smart Visualizations',
    description: 'Query results instantly become charts, tables, and narrative summaries that are easy to scan.',
    icon: ChartColumnBig,
  },
  {
    title: 'Dashboard Creation',
    description: 'Turn a conversation into a live dashboard with one click and keep your best findings organized.',
    icon: LayoutDashboard,
  },
  {
    title: 'Multi-database Support',
    description: 'Connect ClickHouse, PostgreSQL, and Snowflake from one interface built for modern data stacks.',
    icon: Database,
  },
  {
    title: 'Query Retry & Error Fixing',
    description: 'When queries fail, the assistant diagnoses the issue, rewrites the SQL, and keeps moving.',
    icon: RefreshCcw,
  },
];

export const steps: Step[] = [
  {
    title: 'Connect your database',
    description: 'Securely plug Velora into ClickHouse, PostgreSQL, or Snowflake in minutes.',
  },
  {
    title: 'Ask a question',
    description: 'Use plain English to request trends, breakouts, comparisons, or anomaly checks.',
  },
  {
    title: 'AI generates the query',
    description: 'The assistant maps your schema, writes SQL, and shows the logic behind every answer.',
  },
  {
    title: 'Get results and visualizations',
    description: 'Velora returns structured tables, charts, and suggested follow-up questions instantly.',
  },
  {
    title: 'Save as dashboard',
    description: 'Pin the best outputs into dashboards that update the moment the underlying data changes.',
  },
];

export const metrics = [
  { label: 'Time to insight', value: '<30s' },
  { label: 'Supported warehouses', value: '3+' },
  { label: 'Reusable dashboard blocks', value: '∞' },
];

export const chatMessages = [
  {
    role: 'user',
    text: 'Which regions grew revenue fastest in the last 90 days?',
  },
  {
    role: 'assistant',
    text: 'I compared quarter-over-quarter growth by region and found APAC leading at 19.4%, followed by EMEA at 13.1%.',
  },
];

export const dashboardCards = [
  { title: 'Revenue Growth by Region', subtitle: 'Quarter over quarter', trend: '+19.4%' },
  { title: 'Pipeline Conversion', subtitle: 'Last 30 days', trend: '+8.2%' },
  { title: 'Expansion Opportunities', subtitle: 'Accounts with upsell signals', trend: '46 accounts' },
];

export const sqlPreview = `SELECT region,
       SUM(revenue) AS total_revenue,
       ROUND(
         100.0 * (SUM(revenue) - LAG(SUM(revenue)) OVER (ORDER BY region))
         / NULLIF(LAG(SUM(revenue)) OVER (ORDER BY region), 0),
         1
       ) AS growth_pct
FROM quarterly_revenue
WHERE quarter >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY region
ORDER BY growth_pct DESC;`;

export const footerLinks = [
  { label: 'Contact', href: '#' },
];

export const heroOrbitIcons = [Database, Bot, ArrowRight];
