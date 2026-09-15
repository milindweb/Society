/* exportExcel.ts — Reusable client-side Excel export
 *
 * Uses SheetJS (xlsx) to generate .xlsx files from any column+row dataset.
 * Designed to work with the same Column<T>[] shape used by DataTable. */

import * as XLSX from 'xlsx';
import type { Column } from '@/components/data/DataTable';

/** Extract a plain-text cell value from a row, given a column definition.
 *  Uses the raw data key when no render function is provided. */
function extractCellValue<T>(row: T, col: Column<T>): string | number | boolean {
  const raw = (row as Record<string, unknown>)[col.key];
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  return String(raw);
}

/** Generate and download an .xlsx file from tabular data.
 *
 * @param columns - Column definitions (same shape as DataTable's Column<T>[])
 * @param rows - The data array
 * @param filename - Download filename (without extension)
 * @param sheetName - Sheet tab name (default "Sheet1")
 */
export function exportExcel<T>(
  columns: Column<T>[],
  rows: T[],
  filename: string,
  sheetName = 'Sheet1',
): void {
  const headers = columns.map((col) => col.header);
  const data = rows.map((row) =>
    columns.map((col) => extractCellValue(row, col)),
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    const headerLen = col.header.length;
    const maxDataLen = data.reduce((max, row) => {
      const val = String(row[i] ?? '');
      return val.length > max ? val.length : max;
    }, 0);
    return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
