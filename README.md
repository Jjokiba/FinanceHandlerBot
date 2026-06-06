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
