# 💰 Finance Bot — Telegram + Ollama + Excel

A personal finance bot that runs on Telegram, uses a local LLM (via Ollama) to parse your payment messages, and logs everything into an Excel file. Fully local, private, and free to run.

<img style="border-radius:50px;" src="resource\FinanceBot.gif">

---

## 🏗️ Architecture

```
Telegram App
     │
     ▼
Telegram Bot API
     │
     ▼
TypeScript Bot (Node.js)
     │         │
     ▼         ▼
  Ollama    Excel File (.xlsx)
 (local)   (read/write)
  parses    logs payments,
 messages   tracks balances
```

---

## 🎯 Goals

- **Log payments** sent via Telegram messages (e.g. "Paid $150 to João for electricity")
- **Track balances** per category or person
- **Smart recurring alerts** — bot detects your payment patterns from history and asks if you've paid this month

---

## 🔧 Tech Stack

| Layer | Technology | .NET Equivalent |
|---|---|---|
| Language | **TypeScript** (Node.js) | C# |
| Entry Point | **bot.ts** | `Program.cs` |
| Config | **.env** | `appsettings.json` |
| Telegram | **grammy** | Custom HttpClient wrapper / SDK |
| LLM | **Ollama >= 0.5.0** (local) | External HTTP service via `HttpClient` |
| LLM Model | **qwen3-coder:30b** | — |
| Excel | **exceljs** | `EPPlus` / `ClosedXML` |
| Scheduling | **node-cron** | `IHostedService` + `Timer` |
| Interfaces | **types.ts** | Your `Models/` or `DTOs/` folder |

---

## 📦 Key Dependencies

```bash
# Runtime
pnpm add grammy ollama@latest exceljs node-cron dotenv

# Dev
pnpm add -D typescript ts-node @types/node
```

> ⚠️ **ollama package must be version 0.5.0 or higher.** Older versions do not have the `.chat()` method.
> Verify with: `pnpm list ollama` — if it shows anything below 0.5.0, run `pnpm add ollama@latest`

---

## 🗂️ Project Structure

> If you've built a .NET Web API before, think of it like this:

```
finance-bot/
│
├── src/
│   │
│   ├── bot.ts              # → Program.cs + Startup.cs
│   │                       #   Bootstraps everything, registers handlers
│   │
│   ├── types.ts            # → Models/ or DTOs/
│   │                       #   Interfaces: Payment, ParsedMessage, etc.
│   │
│   ├── parser.ts           # → Services/OllamaService.cs
│   │                       #   Calls Ollama, returns structured JSON
│   │                       #   (like calling an external API via HttpClient)
│   │
│   ├── excel.ts            # → Repositories/ExcelRepository.cs
│   │                       #   Reads/writes the .xlsx file
│   │                       #   (think of xlsx as your "database")
│   │
│   └── scheduler.ts        # → BackgroundServices/AlertService.cs
│                           #   Detects recurring payments, sends smart alerts
│
├── data/
│   └── finances.xlsx       # → Your "database" file (keep in .gitignore!)
│
├── .env                    # → appsettings.json (secrets, config)
├── tsconfig.json           # → compiler config (like .csproj build settings)
└── package.json            # → .csproj (dependencies & scripts)
```

---

## 🧱 Layers Breakdown

### `types.ts` — Models / DTOs

```typescript
// Think: public class Payment { ... }
export type TransactionType = 'expense' | 'revenue';

export type Category =
  | 'housing'       // Rent, mortgage
  | 'utilities'     // Water, electricity, gas, internet
  | 'food'          // Groceries, restaurants
  | 'transport'     // Fuel, Uber, public transport
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
```

---

### `parser.ts` — Services/OllamaService

```typescript
// Think: injecting HttpClient to call an external API
// Ollama runs locally on http://localhost:11434
import { Ollama } from 'ollama'; // requires ollama >= 0.5.0
import { Transaction } from './types';

const client = new Ollama({ host: 'http://127.0.0.1:11434' });

export async function parseMessage(userMessage: string): Promise<Transaction> {
  const response = await client.chat({
    model: process.env.OLLAMA_MODEL || 'qwen3-coder:30b',
    messages: [{
      role: 'user',
      content: `Extract financial transaction info as JSON from: "${userMessage}".
                Return ONLY valid JSON with fields:
                - date (ISO format, use today if not mentioned)
                - type ("expense" if paying someone, "revenue" if receiving money)
                - recipient (who was paid, or who paid you)
                - category: one of [housing, utilities, food, transport, health, subscriptions, salary, freelance, other]
                - amount (number, no currency symbols)
                - notes (optional extra info)
                No explanation, no markdown, just raw JSON.`
    }]
  });

  return JSON.parse(response.message.content) as Transaction;
}
```

---

### `excel.ts` — Repositories/ExcelRepository

```typescript
// Think: your DbContext / Repository layer
// xlsx is your "database" — one row per transaction
import ExcelJS from 'exceljs';
import { Transaction } from './types';

const EXCEL_PATH = process.env.EXCEL_PATH!;

export async function logTransaction(tx: Transaction): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const sheet = workbook.getWorksheet('Transactions')!;

  // Append new row
  sheet.addRow([tx.date, tx.type, tx.recipient, tx.category, tx.amount, tx.notes ?? '']);

  // Recalculate totals on the last row (summary footer)
  await recalculateSummary(workbook);

  await workbook.xlsx.writeFile(EXCEL_PATH);
}

async function recalculateSummary(workbook: ExcelJS.Workbook): Promise<void> {
  const sheet = workbook.getWorksheet('Transactions')!;
  const lastRow = sheet.lastRow?.number ?? 1;

  // Remove old total row if it exists
  const existingTotal = sheet.getRow(lastRow);
  if (existingTotal.getCell(1).value === 'TOTAL') {
    sheet.spliceRows(lastRow, 1);
  }

  // Add new total row at the bottom
  // Column E (index 5) = Amount
  // Counts only up to the row before the total
  const dataLastRow = sheet.lastRow!.number;

  const totalRow = sheet.addRow([
    'TOTAL', '', '', '',
    { formula: `SUMIF(B2:B${dataLastRow},"expense",E2:E${dataLastRow})*-1 + SUMIF(B2:B${dataLastRow},"revenue",E2:E${dataLastRow})` },
    'Net balance (revenue - expenses)'
  ]);

  // Style the total row
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '"$"#,##0.00';
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const sheet = workbook.getWorksheet('Transactions')!;
  const transactions: Transaction[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const val = row.getCell(1).value?.toString();
    if (!val || val === 'TOTAL') return; // skip empty and total rows

    transactions.push({
      date:      row.getCell(1).value as string,
      type:      row.getCell(2).value as 'expense' | 'revenue',
      recipient: row.getCell(3).value as string,
      category:  row.getCell(4).value as any,
      amount:    row.getCell(5).value as number,
      notes:     row.getCell(6).value as string | undefined,
    });
  });

  return transactions;
}
```

---

### `scheduler.ts` — BackgroundServices/AlertService

> The scheduler does NOT use hardcoded due dates.
> Instead, it reads transaction history, detects recurring monthly payments,
> and asks if they've been paid this month — like a smart assistant.

```typescript
import cron from 'node-cron';
import { Bot } from 'grammy';
import { getAllTransactions } from './excel';
import { Transaction } from './types';

export function startScheduler(bot: Bot) {
  // Runs every day at 9am
  cron.schedule('0 9 * * *', async () => {
    const alerts = await detectMissingRecurringPayments();

    for (const alert of alerts) {
      await bot.api.sendMessage(
        process.env.CHAT_ID!,
        `Hey! Last month you paid ${alert.category} ($${alert.amount} to ${alert.recipient}).\nHave you paid it this month yet?`
      );
    }
  });
}

async function detectMissingRecurringPayments(): Promise<Transaction[]> {
  const all = await getAllTransactions();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  // Find all expenses paid last month
  const lastMonthPayments = all.filter(
    tx => tx.type === 'expense' && tx.date.startsWith(lastMonthStr)
  );

  // Find all expenses already paid this month
  const thisMonthPayments = all.filter(
    tx => tx.type === 'expense' && tx.date.startsWith(thisMonth)
  );

  const thisMonthCategories = new Set(
    thisMonthPayments.map(tx => `${tx.category}:${tx.recipient}`)
  );

  // Return last month's payments that haven't appeared yet this month
  return lastMonthPayments.filter(
    tx => !thisMonthCategories.has(`${tx.category}:${tx.recipient}`)
  );
}
```

---

### `bot.ts` — Program.cs

```typescript
// Think: entry point — wires everything together (like app.Build() + app.Run())
import { Bot } from 'grammy';
import { parseMessage } from './parser';
import { logTransaction } from './excel';
import { startScheduler } from './scheduler';
import 'dotenv/config';

const bot = new Bot(process.env.BOT_TOKEN!);

// Register message handler (like mapping a Controller route)
bot.on('message:text', async (ctx) => {
  const tx = await parseMessage(ctx.message.text);
  await logTransaction(tx);

  const emoji = tx.type === 'revenue' ? '💰' : '💸';
  await ctx.reply(
    `${emoji} Logged!\n` +
    `Type: ${tx.type}\n` +
    `${tx.type === 'expense' ? 'Paid to' : 'Received from'}: ${tx.recipient}\n` +
    `Category: ${tx.category}\n` +
    `Amount: $${tx.amount}`
  );
});

// Start background service (smart recurring alerts)
startScheduler(bot);

// Start the bot (like app.Run())
bot.start();
console.log('Bot is running...');
```

---

## ⚙️ Configuration (.env)

> Think of this as your `appsettings.json` — never commit it to git!

```env
BOT_TOKEN=your_telegram_bot_token_here
CHAT_ID=your_personal_chat_id
EXCEL_PATH=./data/finances.xlsx
OLLAMA_MODEL=qwen3-coder:30b
```

---

## 📊 Excel File Structure ("Database")

### Sheet 1: `Transactions`

Each row is one transaction. The bot automatically appends rows and keeps a running **net balance** on the last line.

| Date | Type | Recipient | Category | Amount | Notes |
|---|---|---|---|---|---|
| 2026-04-04 | expense | Sabesp | utilities | 45.00 | Water bill |
| 2026-04-04 | expense | Enel | utilities | 120.00 | Electricity |
| 2026-04-04 | expense | landlord | housing | 1200.00 | April rent |
| 2026-04-05 | revenue | Company | salary | 5000.00 | April salary |
| **TOTAL** | | | | **=revenue - expenses** | Net balance |

**Supported categories:**

| Category | Examples |
|---|---|
| `housing` | Rent, mortgage, condo fee |
| `utilities` | Water, electricity, gas, internet |
| `food` | Groceries, restaurants, delivery |
| `transport` | Fuel, Uber, bus pass |
| `health` | Doctor, pharmacy, gym |
| `subscriptions` | Netflix, Spotify, software |
| `salary` | Monthly fixed income |
| `freelance` | Extra / variable income |
| `other` | Anything the LLM can't classify |

### Sheet 2: `Summary` *(optional, future)*
Monthly totals per category for reporting commands like `/report`.

---

## 🚀 Getting Started

### 1. Create your Telegram bot
- Message **@BotFather** on Telegram
- Run `/newbot` and follow the steps
- Copy your **BOT_TOKEN**

### 2. Configure environment
Fill in your `.env` file as shown above.

### 3. Pull your Ollama model
```bash
ollama pull qwen3-coder:30b
```

> Note: `qwen3-coder:30b` requires ~20GB of VRAM/RAM. On a 32GB RAM + RTX 4060 (8GB VRAM) setup, it will use GPU for as many layers as fit and offload the rest to system RAM. Expect ~10-15 tokens/sec. If too slow, fall back to `qwen2.5:7b` which runs fully on GPU at ~50 tokens/sec.

### 4. Run the bot
```bash
npx ts-node src/bot.ts
```

---

## 🖥️ Hardware (Local LLM)

- **GPU:** NVIDIA RTX 4060 (8GB VRAM)
- **RAM:** 32GB system RAM

| Model | VRAM fit | Speed | Quality |
|---|---|---|---|
| `qwen3-coder:30b` | Partial (offloads to RAM) | ~10-15 tok/s | Best |
| `llama3.1:8b` | Full GPU | ~45 tok/s | Good fallback |

---

## 🔒 Privacy & Security

- Everything runs locally — your data never leaves your machine
- **Never commit `.env` or `finances.xlsx` to git!**

```gitignore
# .gitignore
.env
data/
node_modules/
dist/
```

---

## 📋 TODO / Roadmap

- [ ] Basic message parsing + Excel logging
- [ ] Smart recurring payment alerts (scheduler)
- [ ] Balance summary command (`/balance`)
- [ ] Monthly report command (`/report`)
- [ ] Category breakdown (`/breakdown`)
- [ ] Edit/delete last entry
