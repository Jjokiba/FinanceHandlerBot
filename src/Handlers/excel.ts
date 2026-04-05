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

async function recalculateSummary(sheet: ExcelJS.Worksheet): Promise<void> {
  // 1. Collect all valid data rows first (skip header and TOTAL)
  const dataRows: any[][] = [];
  let totalRevenue = 0;
  let totalExpense = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const firstCell = row.getCell(1).value?.toString().trim();
    if (!firstCell || firstCell === 'TOTAL') return; // skip empty and total

    const values = [1,2,3,4,5,6].map(i => row.getCell(i).value);
    dataRows.push(values);

    const type   = values[1]?.toString().trim();
    const amount = Number(values[4]) || 0;
    if (type === 'revenue') totalRevenue += amount;
    if (type === 'expense') totalExpense += amount;
  });

  // 2. Clear everything after the header
  const totalRows = sheet.rowCount;
  for (let i = totalRows; i >= 2; i--) {
    sheet.spliceRows(i, 1);
  }

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
  const totalRow = sheet.addRow([
    'TOTAL', '', '', '',
    totalRevenue - totalExpense,
    'Net balance (revenue - expenses)'
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '"$"#,##0.00';
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
}

export async function logTransaction(tx: Transaction): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const sheetName = getSheetName(tx.date);
  const sheet = ensureMonthSheet(workbook, sheetName);

  // Remove TOTAL row before adding new data
  const lastRow = sheet.lastRow?.number ?? 1;
  const existingTotal = sheet.getRow(lastRow);
  if (existingTotal.getCell(1).value === 'TOTAL') {
    sheet.spliceRows(lastRow, 1);
  }

  // Append the new transaction row
  const row = sheet.addRow([
    tx.date, tx.type, tx.recipient, tx.category, tx.amount, tx.notes ?? ''
  ]);

  // Color code by type
  row.fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: tx.type === 'revenue' ? 'FFE2EFDA' : 'FFFCE4D6' }
  };
  row.getCell(5).numFmt = '"$"#,##0.00';

  // Recalculate total footer
  await recalculateSummary(sheet);

  await workbook.xlsx.writeFile(EXCEL_PATH);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const transactions: Transaction[] = [];

  workbook.eachSheet((sheet) => {
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