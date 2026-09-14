/* print.ts — Print helper for receipts and reports (SRS §4) */

export function printHTML(html: string, title?: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title ?? 'Print'}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1d21; padding: 16px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e2e5e9; padding: 6px 8px; text-align: left; }
        th { background: #f1f3f5; font-weight: 600; }
        .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .title { font-size: 18px; font-weight: bold; }
        .meta { font-size: 12px; color: #4a5058; }
        .footer { margin-top: 24px; font-size: 11px; color: #7a828c; border-top: 1px solid #e2e5e9; padding-top: 8px; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

export function incrementPrintCount(receiptId: string): void {
  void receiptId;
  /* Server-side increment handled by receipts.print action */
}
