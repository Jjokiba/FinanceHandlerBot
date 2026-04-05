import { Ollama } from 'ollama';
import { Transaction } from '../Models/types';

const client = new Ollama({ host: 'http://127.0.0.1:11434' });

export async function parseMessage(userMessage: string, date: Date): Promise<Transaction> {
  const response = await client.chat({
    model: process.env.OLLAMA_MODEL || 'qwen3-coder:30b',
    messages: [{
      role: 'user',
      content: `Extract financial transaction info as JSON from: "${userMessage}".
                Return ONLY valid JSON with fields:
                - date from "${date} "(ISO format "YYYY-MM-DD", use the provided date for context if needed)
                - type ("expense" if paying someone, "revenue" if receiving money)
                - recipient (who was paid, or who paid you)
                - category: one of [housing, utilities, food, transport, health, subscriptions, salary, freelance, , other]
                - amount (number, no currency symbols)
                - notes (optional extra info)
                No explanation, no markdown, just raw JSON.`
    }]
  });

  return JSON.parse(response.message.content) as Transaction;
}

export async function reorganizeWithAI(transactions: Transaction[]): Promise<Transaction[]> {
  const rows = transactions.map(tx =>
    `${tx.date} | ${tx.type} | ${tx.recipient} | ${tx.category} | ${tx.amount} | ${tx.notes ?? ''}`
  );

  const response = await client.chat({
    model: process.env.OLLAMA_MODEL || 'qwen3-coder:30b',
    messages: [{
      role: 'user',
      content: `You are a finance organizer. Here are raw transactions:
                ${rows.join('\n')}

                Reorganize them into a clean JSON array. Each item must have:
                - date (ISO)
                - type ("expense" or "revenue")
                - recipient (string)
                - category (housing/utilities/food/transport/health/subscriptions/salary/freelance/other)
                - amount (number)
                - notes (string or null)

                Rules:
                - Sort by date ascending
                - Fix obvious typos in recipient or category
                - Group similar recurring payments under the same category
                - Return ONLY a valid JSON array, no explanation, no markdown`
    }]
  });

  return JSON.parse(response.message.content) as Transaction[];
}
