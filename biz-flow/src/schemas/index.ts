import { z } from 'zod';

/** ── Chat ─────────────────────────────────────────────────────────────── */

export const chatRequestSchema = z.object({
  userInput: z.string().min(1, 'userInput is required'),
  conversationId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
  mode: z.enum(['chat', 'report']).optional(),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

export const emailReportSchema = z.object({
  pdfBase64: z.string().min(1, 'pdfBase64 is required'),
});

export type EmailReportBody = z.infer<typeof emailReportSchema>;

export const chatJobIdParamSchema = z.object({
  jobId: z.string().uuid('Invalid job id'),
});

/** ── Connections (SQL) ────────────────────────────────────────────────── */

export const addConnectionSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z
    .string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(['postgres', 'clickhouse'], { message: 'Unsupported connection type' })),
  host: z.string().min(1, 'host is required'),
  port: z.coerce.number().int().positive(),
  database: z.string().min(1, 'database is required'),
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
  description: z.string().optional(),
});

export type AddConnectionBody = z.infer<typeof addConnectionSchema>;

export const connectionIdParamSchema = z.object({
  id: z.string().uuid('Invalid connection id'),
});

export const tableColumnParamsSchema = z.object({
  id: z.string().uuid('Invalid connection id'),
  table: z.string().min(1, 'table is required'),
});

/** ── CSV ──────────────────────────────────────────────────────────────── */

const blockedUrlPatterns = ['localhost', '127.0.0.1', 'file://'];

export const addCsvConnectionSchema = z.object({
  name: z.string().min(1, 'name is required').trim(),
  file_url: z
    .string()
    .min(1, 'file_url is required')
    .trim()
    .url('file_url must be a valid URL')
    .refine((u) => u.startsWith('https://'), {
      message: 'file_url must start with https://',
    })
    .refine(
      (u) => !blockedUrlPatterns.some((p) => u.includes(p)),
      { message: 'file_url must not contain localhost, 127.0.0.1, or file://' },
    ),
  description: z.string().min(1, 'description is required').trim(),
});

export type AddCsvConnectionBody = z.infer<typeof addCsvConnectionSchema>;

export const csvQuerySchema = z.object({
  connection_id: z.string().uuid('connection_id must be a valid UUID'),
  query: z.string().min(1, 'query is required'),
});

export type CsvQueryBody = z.infer<typeof csvQuerySchema>;

/** ── Conversations ────────────────────────────────────────────────────── */

export const conversationIdParamSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation id'),
});

/** ── Dashboards ─────────────────────────────────────────────────────────── */

export const saveDashboardSchema = z.object({
  connectionId: z.string().uuid('connectionId must be a valid UUID'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  fragments: z.array(z.unknown()),
  queries: z.array(z.unknown()),
});

export type SaveDashboardBody = z.infer<typeof saveDashboardSchema>;

export const dashboardIdParamSchema = z.object({
  id: z.string().uuid('Invalid dashboard id'),
});

/** ── Settings ───────────────────────────────────────────────────────────── */

export const updateSettingsSchema = z.object({
  query_run_mode: z.enum(['ask_every_time', 'auto_run'], {
    message: 'query_run_mode must be ask_every_time or auto_run',
  }),
});

export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;

export const sendInvitesSchema = z.object({
  emails: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'Provide at least one email'),
});

export type SendInvitesBody = z.infer<typeof sendInvitesSchema>;
