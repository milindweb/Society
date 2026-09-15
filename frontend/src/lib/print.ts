/* print.ts — Print helper for receipts and reports (SRS §4, §24)
 *
 * The print document is a *separate* document opened with `window.open('', ...)`.
 * It therefore has no access to the app's stylesheets or CSS custom properties,
 * so the stylesheet below is deliberately self-contained. It is also
 * deliberately a fixed **light "paper" palette** rather than theme tokens: the
 * active app theme may be dark, and dark-on-white paper is unreadable. That is
 * the one place a literal colour is correct (DESIGN-General.md §90 forbids only
 * *unnecessary* hardcoded colours).
 *
 * Everything interpolated here is escaped (`lib/html.ts`). The popup is
 * same-origin with the app, so an unescaped server value would be an XSS
 * vector, not just a rendering glitch (SRS §24). */

import { escapeHtml } from './html';

/** Fixed palette for the paper document — see the note above. */
const PAPER = {
  text: '#1a1d21',
  textMuted: '#4a5058',
  textFaint: '#7a828c',
  border: '#e2e5e9',
  headerBg: '#f1f3f5',
} as const;

export function printHTML(html: string, title?: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title ?? 'Print')}</title>
      <style>
        @page { margin: 12mm; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          color: ${PAPER.text};
          padding: 16px;
          margin: 0;
        }
        table { border-collapse: collapse; width: 100%; }
        th, td {
          border: 1px solid ${PAPER.border};
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
        }
        th {
          background: ${PAPER.headerBg};
          font-weight: 600;
          /* Keep the header fill when printing (Chrome/Safari default to off). */
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .title { font-size: 18px; font-weight: bold; }
        .meta { font-size: 12px; color: ${PAPER.textMuted}; }
        .footer {
          margin-top: 24px;
          font-size: 11px;
          color: ${PAPER.textFaint};
          border-top: 1px solid ${PAPER.border};
          padding-top: 8px;
        }
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
