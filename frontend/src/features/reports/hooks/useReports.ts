/* useReports.ts — FE-12 report catalog, run and export
 *
 * Every mutation/report call is non-optimistic: nothing is cached locally, the
 * server is the only source of rows and totals.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as reportService from '@/services/reportService';
import type { ReportFilters } from '@/services/reportService';
import type { PageMeta } from '@/types/api';
import type { ReportCatalog, ReportDefinition, ReportResult } from '@/types/domain';

const DEFAULT_PAGE_SIZE = 25;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/* ---------------------------------------------------------------------------
 * Catalog
 * ------------------------------------------------------------------------- */

/** The report catalog. Loaded once; the definitions are static on the backend. */
export function useReportCatalog(): {
  catalog: ReportCatalog;
  definitions: ReportDefinition[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [catalog, setCatalog] = useState<ReportCatalog>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    reportService
      .getReportCatalog()
      .then((result) => {
        if (cancelled) return;
        setCatalog(result ?? {});
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalog({});
        setError(messageOf(err, 'Could not load the report catalog'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  /* The backend returns an object keyed by reportKey. Order is not guaranteed,
   * so sort by title for a stable, predictable list. */
  const definitions = Object.keys(catalog)
    .map((key) => catalog[key])
    .filter((def): def is ReportDefinition => Boolean(def))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { catalog, definitions, loading, error, reload };
}

/* ---------------------------------------------------------------------------
 * Running a report
 * ------------------------------------------------------------------------- */

export interface UseReportParams {
  reportKey: string;
  filters?: ReportFilters;
  pageSize?: number;
}

export interface UseReportReturn {
  result: ReportResult | null;
  page: PageMeta | null;
  loading: boolean;
  error: string | null;
  /** True while a CSV export is in flight. */
  exporting: boolean;
  exportError: string | null;
  pageNumber: number;
  setPage: (page: number) => void;
  setFilters: (filters: ReportFilters) => void;
  reload: () => void;
  exportCsv: () => void;
}

/** Run one report, with pagination and filters.
 *
 * `totals` comes from the server and covers ALL filtered rows, not the page —
 * it is passed through untouched and never recomputed here.
 *
 * Changing `reportKey` resets pagination and filters, because a filter that is
 * valid for one report (say `periodKey`) means nothing to another.
 */
export function useReport({ reportKey, filters, pageSize = DEFAULT_PAGE_SIZE }: UseReportParams): UseReportReturn {
  const [result, setResult] = useState<ReportResult | null>(null);
  const [page, setPageMeta] = useState<PageMeta | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [activeFilters, setActiveFilters] = useState<ReportFilters>(filters ?? {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  /* Signature of the filter set, so the effect re-runs on content change rather
   * than on object identity (callers often build the object inline). */
  const filterSig = JSON.stringify(activeFilters);

  /* Reset paging and filters when the report itself changes. */
  const previousKey = useRef(reportKey);
  useEffect(() => {
    if (previousKey.current !== reportKey) {
      previousKey.current = reportKey;
      setPageNumber(1);
      setActiveFilters(filters ?? {});
      setResult(null);
      setPageMeta(null);
    }
    // `filters` intentionally excluded: it is only read when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    reportService
      .runReport({
        reportKey,
        filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
        page: pageNumber,
        pageSize,
      })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setPageMeta(data.page ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(null);
        setPageMeta(null);
        setError(messageOf(err, 'Could not run this report'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportKey, filterSig, pageNumber, pageSize, tick, activeFilters]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const setFilters = useCallback((next: ReportFilters) => {
    setActiveFilters(next);
    setPageNumber(1);
  }, []);

  /** Export to CSV on Drive, then open the returned Drive URL.
   *
   * The backend does not stream file bytes, so this must navigate to `fileUrl`.
   * Opened in a new tab so the report view is not lost. */
  const exportCsv = useCallback(() => {
    setExporting(true);
    setExportError(null);

    reportService
      .exportReport({
        reportKey,
        filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
        format: 'CSV',
      })
      .then((data) => {
        if (data?.fileUrl) {
          window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
        } else {
          setExportError('The export completed but no download link was returned.');
        }
      })
      .catch((err: unknown) => {
        setExportError(messageOf(err, 'Export failed'));
      })
      .finally(() => {
        setExporting(false);
      });
  }, [reportKey, activeFilters]);

  return {
    result,
    page,
    loading,
    error,
    exporting,
    exportError,
    pageNumber,
    setPage: setPageNumber,
    setFilters,
    reload,
    exportCsv,
  };
}

/** Just the sorted report keys, for navigation and route validation. */
export function useReportKeys(): string[] {
  const { definitions } = useReportCatalog();
  return definitions.map((def) => def.key);
}
