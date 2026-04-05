import ExcelJS from 'exceljs';
import { Transaction } from '../Models/types';
import { EXCEL_PATH } from '../Models/paths';

// e.g. "2026-04" → "Apr 2026"
function getSheetName(date: string): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function ensureMonthSheet(workbook: ExcelJS.Workbook, sheetName: string): ExcelJS.Worksheet {
  
  let sheet = workbook.getWorksheet(sheetName);
  
  if (sheet) {
    workbook.removeWorksheet(sheetName);
    //@ts-ignore
    sheet = undefined;
  }

  if (!sheet) {
    // Create the sheet with header row if it doesn't exist
    sheet = workbook.addWorksheet(sheetName);

    const header = sheet.addRow(['Date', 'Type', 'Recipient', 'Category', 'Amount', 'Notes']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
    header.alignment = { horizontal: 'center' };

    // Set column widths upfront
    sheet.columns = [
      { key: 'date',      width: 14 },
      { key: 'type',      width: 12 },
      { key: 'recipient', width: 20 },
      { key: 'category',  width: 18 },
      { key: 'amount',    width: 14 },
      { key: 'notes',     width: 30 },
    ];
  }

  return sheet;
}

async function recalculateSummary(sheet: ExcelJS.Worksheet, transactions: Transaction[]): Promise<void> {
  // 1. Collect all valid data rows first (skip header and TOTAL)
  const dataRows: any[][] = [];
  let totalRevenue = 0;
  let totalExpense = 0;

  transactions.forEach(tx => {
    console.log('Processing transaction for summary:', tx.date, tx.type, tx.amount);
    const values = [tx.date, tx.type, tx.recipient, tx.category, tx.amount, tx.notes ?? ''];
    dataRows.push(values);

    const type   = tx.type;
    const amount = Number(tx.amount) || 0;
    if (type === 'revenue') totalRevenue += amount;
    if (type === 'expense') totalExpense += amount;
  });

  // 3. Rewrite data rows cleanly
  for (const values of dataRows) {
    const row = sheet.addRow(values);
    const type = values[1]?.toString().trim();
    row.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: type === 'revenue' ? 'FFE2EFDA' : 'FFFCE4D6' }
    };
    row.getCell(5).numFmt = '"$"#,##0.00';
  }

  // 4. Add fresh TOTAL row at the bottom
  const dataLastRow = sheet.lastRow!.number;
  const totalRow = sheet.addRow([
    'TOTAL', '', '', '',
    { formula: `SUMIF(B2:B${dataLastRow},"revenue",E2:E${dataLastRow})-SUMIF(B2:B${dataLastRow},"expense",E2:E${dataLastRow})` },
    'Net balance'
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '"$"#,##0.00';
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
}

export async function logTransaction(tx: Transaction): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = getSheetName(tx.date);
  let transactions = await getAllTransactions(sheetName);
  
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = ensureMonthSheet(workbook, sheetName);

  
  // Append the new transaction row
  transactions.push(tx);

  // Recalculate total footer
  await recalculateSummary(sheet, transactions);

  await workbook.xlsx.writeFile(EXCEL_PATH);
}

export async function getAllTransactions(sheetName?: string|undefined): Promise<Transaction[]> {
  const workbook = new ExcelJS.Workbook();
  
  await workbook.xlsx.readFile(EXCEL_PATH);
  if(sheetName !== undefined){
      const sheet = workbook.getWorksheet(sheetName);
  }
  const transactions: Transaction[] = [];

  workbook.eachSheet((sheet) => {
    if(sheetName === undefined || (sheetName !== undefined && sheet.name === sheetName)) {
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
    }
  });

  return transactions;
}

export async function buildOrganizedSheet(workbook: ExcelJS.Workbook, transactions: Transaction[]): Promise<void> {
  // Delete and recreate the Organized sheet
  const existing = workbook.getWorksheet('Organized');
  if (existing) workbook.removeWorksheet(existing.id);

  const sheet = workbook.addWorksheet('Organized');

  // Header
  const header = sheet.addRow(['Date', 'Type', 'Recipient', 'Category', 'Amount', 'Notes']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
  header.alignment = { horizontal: 'center' };

  sheet.columns = [
    { key: 'date',      width: 14 },
    { key: 'type',      width: 12 },
    { key: 'recipient', width: 20 },
    { key: 'category',  width: 18 },
    { key: 'amount',    width: 14 },
    { key: 'notes',     width: 30 },
  ];

  // Data rows
  for (const tx of transactions) {
    const row = sheet.addRow([
      tx.date, tx.type, tx.recipient, tx.category, tx.amount, tx.notes ?? ''
    ]);

    row.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: tx.type === 'revenue' ? 'FFE2EFDA' : 'FFFCE4D6' }
    };
    row.getCell(5).numFmt = '"$"#,##0.00';
  }

  // Total row
  const dataLastRow = sheet.lastRow!.number;
  const totalRow = sheet.addRow([
    'TOTAL', '', '', '',
    { formula: `SUMIF(B2:B${dataLastRow},"revenue",E2:E${dataLastRow})-SUMIF(B2:B${dataLastRow},"expense",E2:E${dataLastRow})` },
    'Net balance'
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '"$"#,##0.00';
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
}