import { supabase } from '../config/db';
import { mistral } from '../config/llm';
import { AgentResult } from '../agent/types';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import { marked } from 'marked';

export interface ReportFlowInput {
  query: string;
  userId: string;
  userEmail: string;
  agentResult: AgentResult;
}

export interface ReportResult {
  mode: 'report';
  reportMarkdown: string;
  pdfBase64: string;
  actions: {
    canDownload: boolean;
    canEmail: boolean;
  };
}

export function shouldUseWebSearch(query: string): boolean {
  const keywords = ['market', 'industry', 'trend', 'benchmark', 'competitor'];
  return keywords.some((k) => query.toLowerCase().includes(k));
}

export async function tavilySearch(query: string): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: true,
    }),
  });

  const data = (await res.json()) as any;
  return data.answer || '';
}

export async function generateReport(input: {
  query: string;
  summary?: string;
  finalData?: any;
  externalData: string | null;
}): Promise<string> {
  const prompt = `You are a senior business analyst creating a HIGHLY PROFESSIONAL report.

This report will be presented to business stakeholders (CEO, managers).

User Query:
${input.query}

Data Summary:
${input.summary || 'No data summary available.'}

Data:
${JSON.stringify(input.finalData || [], null, 2)}

External Context:
${input.externalData || 'No external context available.'}

STRICT RULES:
* No fluff
* No raw data dumping
* Every sentence must add value
* Use numbers and insights
* Professional tone (consulting-grade, McKinsey style)
* DO NOT wrap the entire output in markdown code blocks (\`\`\`markdown or \`\`\`)
* OUTPUT CLEAN RAW MARKDOWN DATA DIRECTLY

STRUCTURE:
# Title
## Executive Summary
## Key Insights
## Detailed Analysis
## External Context (if available)
## Visual Explanation
* Describe charts/diagrams if useful
## Conclusion
## Recommendations

OPTIONAL:
* Include tables or structured comparisons if useful`;

  const res = await mistral.invoke(prompt);
  return res.content.toString();
}

function cleanMarkdown(md: string): string {
  // Remove markdown code block markers if the LLM added them
  return md.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '').trim();
}

export async function generatePDF(markdown: string): Promise<Buffer> {
  const cleanMd = cleanMarkdown(markdown);
  const html = await marked.parse(cleanMd);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Add some basic styling for the PDF
  const styledHtml = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.7; 
            color: #111; 
            padding: 50px; 
            max-width: 800px;
            margin: 0 auto;
          }
          h1 { font-weight: 900; font-size: 32px; color: #000; border-bottom: 3px solid #f06543; padding-bottom: 15px; margin-bottom: 30px; letter-spacing: -0.02em; }
          h2 { font-weight: 800; font-size: 20px; color: #333; margin-top: 45px; margin-bottom: 15px; border-left: 4px solid #f06543; padding-left: 15px; }
          p { margin-bottom: 15px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 14px; border: 1px solid #eee; }
          th, td { border: 1px solid #eee; padding: 12px 15px; text-align: left; }
          th { background-color: #f9fafb; font-weight: 700; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; }
          blockquote { border-left: 5px solid #f06543; padding: 10px 25px; margin: 30px 0; background: #fffcfb; font-style: italic; color: #555; }
          ul, ol { margin-bottom: 25px; padding-left: 20px; }
          li { margin-bottom: 10px; color: #444; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.2em; text-align: center; }
        </style>
      </head>
      <body>
        ${html}
        <div class="footer">Velora Intelligence Engine • Strategic Report</div>
      </body>
    </html>
  `;

  await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ 
    format: 'A4', 
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    printBackground: true
  });

  await browser.close();
  return Buffer.from(pdf);
}

export async function sendReportEmail(email: string, pdfBuffer: Buffer) {
  console.log('[DEBUG] SMTP Config:', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    from: process.env.SMTP_SENDER_EMAIL
  });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Velora" <${process.env.SMTP_SENDER_EMAIL}>`,
    to: email,
    subject: 'Your Velora Report',
    text: 'Please find your report attached.',
    attachments: [
      {
        filename: 'velora-report.pdf',
        content: pdfBuffer,
      },
    ],
  });
}

export async function runReportFlow(input: ReportFlowInput): Promise<ReportResult> {
  const { query, userId, userEmail, agentResult } = input;

  // Step 1 — detect need for web search
  const useWeb = shouldUseWebSearch(query);

  // Step 2 — fetch external data
  let externalData = null;
  if (useWeb) {
    try {
      externalData = await tavilySearch(query);
    } catch (error) {
      console.error('Tavily search failed:', error);
    }
  }

  // Step 3 — generate report
  const rawMarkdown = await generateReport({
    query,
    summary: agentResult.summary,
    finalData: agentResult.finalData,
    externalData,
  });
  const reportMarkdown = cleanMarkdown(rawMarkdown);

  // Step 4 — generate PDF
  const pdfBuffer = await generatePDF(reportMarkdown);

  return {
    mode: 'report',
    reportMarkdown,
    pdfBase64: pdfBuffer.toString('base64'),
    actions: {
      canDownload: true,
      canEmail: true,
    },
  };
}
