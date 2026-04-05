import cron from 'node-cron';
import { Bot } from 'grammy';
import { getAllTransactions } from './Handlers/excel';
import { Transaction } from './Models/types';

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
