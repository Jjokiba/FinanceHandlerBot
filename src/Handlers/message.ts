import { buildOrganizedSheet, getAllTransactions, logTransaction } from "./excel";
import { parseMessage, reorganizeWithAI } from "./ollamaCaller";
import ExcelJS from 'exceljs';
import { EXCEL_PATH } from "../Models/paths";



export async function financeHandler(ctx : any) {
    const userMessage = ctx.message.text.replace("/balance", '').replace("/b", '').trim();
    console.log('txt:', userMessage);
    console.log('-------------------');
    if(!userMessage || userMessage.length === 0) {
        await ctx.reply('Please provide a message to log a transaction.');
        return;
    }

    console.log('Message date:', new Date(ctx.message.date * 1000));
    const date = new Date(ctx.message.date * 1000);
    const tx = await parseMessage(userMessage, date);

    console.log('Parsed transaction:', tx);
    await logTransaction(tx);
    console.log('-------------------');
    
    const emoji = tx.type === 'revenue' ? '💰' : '💸';
    await ctx.reply(
    `${emoji} Logged!\n` +
    `Type: ${tx.type}\n` +
    `${tx.type === 'expense' ? 'Paid to' : 'Received from'}: ${tx.recipient}\n` +
    `Category: ${tx.category}\n` +
    `Amount: $${tx.amount}`
    );
}

export async function organize(ctx : any) {
    const userMessage = ctx.message.text.replace("/organize", '').trim();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_PATH);
    
    // 1. Read raw data from the original sheet
    const raw = await getAllTransactions();
    console.log('Raw transactions:', raw);
    await ctx.reply(
    `💸 Got all Transactions...\n` 
    );
    // 2. Send to LLM for reorganization
    const organized = await reorganizeWithAI(raw);
    await ctx.reply(
    `💸 LLM Replied the organization...\n` 
    );
    // 3. Delete "Organized" sheet if it already exists
    const existing = workbook.getWorksheet('Organized');
    if (existing) {
        workbook.removeWorksheet(existing.id);
        await ctx.reply(
        `💸 Deleted Old Organized Sheet...\n` 
        );
    }

    // 4. Recreate it fresh
    await buildOrganizedSheet(workbook, organized);

    await workbook.xlsx.writeFile(EXCEL_PATH);
    
    await ctx.reply(
    `💸 Organized Excel generated!\n` 
    );
}
  

