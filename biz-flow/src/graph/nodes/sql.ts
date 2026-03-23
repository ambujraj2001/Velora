import { GraphState } from '../../types';
import { mistral } from '../../config/llm';

export async function sqlGenerationNode(state: GraphState): Promise<Partial<GraphState>> {
  try {
    const historyText = state.history?.map((h) => `${h.role}: ${h.content}`).join('\n') || '';

    const response = await mistral.invoke([
      [
        'system',
        `You are a ClickHouse SQL generator.
Rules:
1. ONLY return the SQL query.
2. Only SELECT queries are allowed.
3. Use the provided schema. 
4. If a query is a follow-up, consider the history.
5. Limit results to 100 unless specified.

Schema:
${state.schemaContext}`,
      ],
      ['user', `History:\n${historyText}\n\nNew Request: ${state.userInput}`],
    ]);

    let sql = response.content.toString().trim();
    // basic cleanup
    if (sql.startsWith('```sql')) {
      sql = sql.replace('```sql', '');
    }
    if (sql.startsWith('```')) {
      sql = sql.replace('```', '');
    }
    if (sql.endsWith('```')) {
      sql = sql.slice(0, sql.lastIndexOf('```'));
    }

    // Safety check
    const upperSql = sql.toUpperCase();
    if (
      upperSql.includes('INSERT ') ||
      upperSql.includes('UPDATE ') ||
      upperSql.includes('DELETE ') ||
      upperSql.includes('DROP ') ||
      upperSql.includes('ALTER ')
    ) {
      throw new Error('Only SELECT queries are allowed.');
    }

    if (!upperSql.includes('LIMIT ')) {
      sql = `${sql} LIMIT 100`;
    }

    return { sql: sql.trim(), error: undefined }; // clear any previous errors
  } catch (err: any) {
    console.error(err);
    return {
      error: err.message,
    };
  }
}
