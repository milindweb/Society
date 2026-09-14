/* csv.ts — CSV export helper for reports (SRS §14) */

export function toCSVRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(',');
}

export function generateCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const lines = [toCSVRow(headers), ...rows.map(toCSVRow)];
  return lines.join('\n');
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
