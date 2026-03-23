import { ChatMistralAI } from '@langchain/mistralai';
import dotenv from 'dotenv';
dotenv.config();

export const mistral = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  endpoint: process.env.MISTRAL_API_BASE || 'https://api.mistral.ai/v1',
});
