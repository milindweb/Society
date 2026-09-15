/* ReceiptViewPage.tsx — FE-06
 * Renders a receipt for review and printing.
 *
 * `receipts.print` increments `printCount` server-side and is audited, so the UI calls it
 * and then displays whatever the server returns rather than optimistically bumping a local
 * counter (SRS §4, §23). Only POSTED receipts can be printed.
 * Society identity is read from `configStore`; the receipt payload itself does not carry it. */

import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { AmountText } from '@/components/data/AmountText';
import { useReceipt } from '../hooks/useReceipts';
import { useConfigStore } from '@/state/configStore';
import { formatDate, formatDateTime } from '@/lib/dates';
import { printHTML } from '@/lib/print';
import { escapeHtml } from '@/lib/html';
import { formatEnumKey } from '@/lib/format';

export default function ReceiptViewPage() {
  const navigate = useNavigate();
  const { receiptId } = useParams<{ receiptId: string }>();
  const { receipt, loading, error, printing, reload, markPrinted } = useReceipt(receiptId);
  const { societyName, currencySymbol } = useConfigStore();

  const handlePrint = async () => {
    if (!receipt) return;
    // Register the print with the server first, then render the print document.
    await markPrinted();
    printHTML(buildReceiptHtml(receipt, societyName), `Receipt ${receipt.receiptNumber}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div>
        <PageHeader title="Receipt" />
        <ErrorState
          title="Receipt not found"
          message={error ?? 'This receipt may have been removed.'}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const printCount = Number(receipt.printCount ?? 0);
  const canPrint = receipt.statusKey === 'POSTED';

  return (
    <div>
      <PageHeader
        title={`Receipt ${receipt.receiptNumber}`}
        subtitle={receipt.flatNumber ? `Flat ${receipt.flatNumber}` : `Flat ${receipt.flatId}`}
        breadcrumbs={
          <Breadcrumb
            items={[
              { label: 'Receipts', route: '/receipts', onClick: () => navigate('/receipts') },
              { label: receipt.receiptNumber },
            ]}
          />
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              icon={<Icon name="back" size={16} />}
              onClick={() => navigate('/receipts')}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              icon={<Icon name="refresh" size={16} />}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
            <Button
              icon={<Icon name="print" size={16} />}
              onClick={() => void handlePrint()}
              loading={printing}
              disabled={!canPrint}
            >
              Print Receipt
            </Button>
          </div>
        }
      />

      {!canPrint && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="warning">
            This receipt is not in POSTED state, so it cannot be printed. Cancelled or reversed
            payments keep their receipt record for audit.
          </Alert>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {/* Printable receipt body */}
      <Card>
        <CardBody>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{societyName || 'Housing Society'}</h2>
            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Payment Receipt
            </p>
          </div>

          <div className="hs-grid hs-grid-cols-1 hs-lg-grid-cols-2" style={{ gap: 'var(--space-4)' }}>
            <DescriptionList
              items={[
                { label: 'Receipt Number', value: receipt.receiptNumber },
                { label: 'Payment Date', value: formatDate(receipt.paymentDate) },
                {
                  label: 'Flat',
                  value: receipt.flatNumber || receipt.flatId,
                },
                { label: 'Status', value: <Badge variant="success">{receipt.statusKey}</Badge> },
              ]}
            />
            <DescriptionList
              items={[
                {
                  label: 'Amount',
                  value: (
                    <strong style={{ fontSize: 'var(--text-lg)' }}>
                      <AmountText amount={receipt.amount} />
                    </strong>
                  ),
                },
                {
                  label: 'Issued At',
                  value: receipt.issuedAt ? formatDateTime(receipt.issuedAt) : '—',
                },
                { label: 'Template', value: receipt.templateKey || 'DEFAULT' },
                {
                  label: 'Print Count',
                  value: <Badge variant={printCount > 0 ? 'warning' : 'neutral'}>{String(printCount)}</Badge>,
                },
              ]}
            />
          </div>

          <p
            style={{
              marginTop: 'var(--space-5)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Amounts shown are those recorded by the server. Currency: {currencySymbol}. Every print
            is logged, and the print count above reflects the server&apos;s value.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/** Minimal printable document. Kept in the page because it is presentation-only. */
function buildReceiptHtml(
  receipt: {
    receiptNumber: string;
    paymentDate: string;
    flatNumber?: string;
    flatId: string;
    amount: number;
    statusKey: string;
    issuedAt?: string;
  },
  societyName: string,
): string {
  const rows: Array<[string, string]> = [
    ['Receipt Number', receipt.receiptNumber],
    ['Payment Date', formatDate(receipt.paymentDate)],
    ['Flat', receipt.flatNumber || receipt.flatId],
    ['Amount', new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(receipt.amount)],
    ['Status', formatEnumKey(receipt.statusKey)],
    ['Issued At', receipt.issuedAt ? formatDateTime(receipt.issuedAt) : '—'],
  ];

  return `
    <div class="header">
      <div>
        <div class="title">${escapeHtml(societyName || 'Housing Society')}</div>
        <div class="meta">Payment Receipt</div>
      </div>
      <div class="meta">${escapeHtml(receipt.receiptNumber)}</div>
    </div>
    <table>
      <tbody>
        ${rows
          .map(
            ([label, value]) =>
              `<tr><th style="width:40%">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <div class="footer">
      This is a system-generated receipt. Amounts are as recorded by the society ledger.
    </div>
  `;
}
