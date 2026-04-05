import 'dotenv/config';
import { Bot } from 'grammy';
import { startScheduler } from './scheduler';
import { financeHandler, organize } from './Handlers/message';

const bot = new Bot(process.env.BOT_TOKEN!);

// Register message handler (like mapping a Controller route)
bot.on('message:text', async (ctx) => {
  if(process.env.CHAT_ID == 'undefined') {
    await ctx.reply(`Your chat ID is: ${ctx.chat.id}\nPlease set this CHAT_ID in your .env file to enable the bot's functionality.`);
  } else if(ctx.chat.id.toString() === process.env.CHAT_ID) {
    const text = ctx.message.text.trim();
    const command = text.split(' ')[0];
    
    switch (command) {
      case '/help':
      case '/h':
          await ctx.reply('Hello, Im a finnance bot helper, I log Out all transactions you send me in chat\n Commands:\n\r/o \n   -- Organize Transactions\n\n/b "your payment message" \n   -- LLM Reads your input converts into a JSON and write in the finances.xlsx\n\r   Example: /b "Paid $50 for groceries at Walmart"');
        return;
      case '/b':
      case '/balance':
          await financeHandler(ctx);          
        return;
      case '/o':
      case '/organize':
          await organize(ctx);          
        return;
      default:
          await ctx.reply('🤔 Unkown command.\n Type "/help" for instructions on how to use the bot.');
        return;
    }
  }
});

// Start background service (smart recurring alerts)
startScheduler(bot);

// Start the bot (like app.Run())
bot.start();
console.log('Bot is running...');
