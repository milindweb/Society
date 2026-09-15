/* ExportButton.tsx — Reusable Excel export button
 *
 * Drop into any page header, card header, or toolbar.
 * Accepts the same Column<T>[] shape as DataTable. */

import { useState, useCallback } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { exportExcel } from '@/lib/exportExcel';
import type { Column } from '@/components/data/DataTable';

interface ExportButtonProps<T> {
  columns: Column<T>[];
  data: T[];
  filename: string;
  sheetName?: string;
  label?: string;
  permission?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
}

export function ExportButton<T>({
  columns,
  data,
  filename,
  sheetName,
  label = 'Export Excel',
  variant = 'secondary',
  size = 'sm',
}: ExportButtonProps<T>) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    if (data.length === 0) return;
    setExporting(true);
    // Yield to the event loop so the spinner renders before the blocking xlsx work
    setTimeout(() => {
      try {
        exportExcel(columns, data, filename, sheetName);
      } finally {
        setExporting(false);
      }
    }, 50);
  }, [columns, data, filename, sheetName]);

  return (
    <Button
      variant={variant}
      size={size}
      icon={<Icon name="download" size={16} />}
      onClick={handleExport}
      loading={exporting}
      disabled={data.length === 0}
    >
      {label}
    </Button>
  );
}
