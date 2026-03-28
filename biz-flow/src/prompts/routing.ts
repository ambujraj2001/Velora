import { PromptTemplate } from '@langchain/core/prompts';

/**
 * Prompt to generate a high-quality semantic description for a dataset.
 */
export const dataIndexingPrompt = PromptTemplate.fromTemplate(`
You are a senior data architect. Generate a HIGH-QUALITY semantic description for the following data source.

Dataset Name: {name}
Type: {type}
Schema: {schema}
Sample Rows: {samples}

Instructions:
1. Explain what the dataset represents in business terms.
2. Explain what key columns represent semantically.
3. Explicitly mention what types of questions this dataset can and cannot answer.
4. Use natural, descriptive language that matches how a human would ask questions.
5. BE CONCISE BUT Semantic. Avoid generic phrases like "this is a table".

Output only the description text.
`);

/**
 * Prompt to select the best connection from a list of candidates.
 */
export const dataRoutingPrompt = PromptTemplate.fromTemplate(`
You are an intelligent data source router.

User Query:
"{query}"

Available Data Sources:
{candidates}

Instructions:
1. Understand the user's intent (what metrics, dimensions, or filters they need).
2. Match the query with the semantic meaning of each dataset.
3. Select the ONE best dataset that can answer the query accurately.

Rules:
- DO NOT ask the user for clarification.
- DO NOT return multiple options.
- Return ONLY a STRICT JSON object.

Output format:
{{
  "connectionId": "the-uuid-of-the-best-connection",
  "reason": "short explanation of why this was chosen"
}}
`);

/**
 * Prompt to validate if a selected connection is capable of answering a query.
 */
export const routingValidationPrompt = PromptTemplate.fromTemplate(`
You are validating if a specific dataset can answer a user's query.

Query: "{query}"

Selected Dataset Description:
"{description}"

Rules:
1. If the dataset clearly contains the necessary columns and domain knowledge to answer the query -> status: "VALID".
2. If the query requires data that is missing (e.g. asking for "revenue" in an "employees" table) -> status: "INVALID".
3. Return ONLY a STRICT JSON object.

Output format:
{{
  "status": "VALID" | "INVALID",
  "reason": "explanation of the decision"
}}
`);
