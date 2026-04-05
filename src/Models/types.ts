// Transaction types and interfaces for Finance Bot
export type TransactionType = 'expense' | 'revenue';

export type Category =
  | 'housing'       // Rent, mortgage
  | 'utilities'     // Water, electricity, gas, internet
  | 'food'          // Groceries, restaurants
  | 'transport'     // Fuel, Uber, public transport
  | 'leisure'       // Movies, hobbies
  | 'health'        // Doctor, pharmacy, gym
  | 'subscriptions' // Streaming, software
  | 'salary'        // Monthly income
  | 'freelance'     // Extra income
  | 'other';        // Anything unrecognized

export interface Transaction {
  date: string;           // ISO format: "2026-04-04"
  type: TransactionType;  // "expense" or "revenue"
  recipient: string;      // Who you paid OR who paid you
  category: Category;
  amount: number;
  notes?: string;
}
