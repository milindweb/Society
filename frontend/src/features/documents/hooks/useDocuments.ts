/* useDocuments.ts — FE-09 document data access
 * frontend-architecture.md §1: hooks own data access; pages never fetch.
 * SRS §9: one central Documents module — metadata in Sheets, binaries in Drive.
 *
 * No optimistic UI (SRS §23): every write reloads from the server, so the status
 * and version shown are the persisted ones. */

import { useState, useCallback, useEffect } from 'react';
import * as documentService from '@/services/documentService';
import { generateClientId } from '@/lib/idempotency';
import type { Document } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/** Module constant, not state — keeps the load callback stable. */
const PAGE_SIZE = 25;

export interface DocumentFilterState {
  categoryId?: string;
  linkedEntityType?: string;
  /** When false/undefined the server drops ARCHIVED rows (SRS §9). */
  includeArchived?: boolean;
}

export interface UseDocumentListReturn {
  documents: Document[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  setFilters: (next: Partial<DocumentFilterState>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useDocumentList(initial?: DocumentFilterState): UseDocumentListReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DocumentFilterState>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await documentService.listDocuments({
        page: pageNumber,
        pageSize: PAGE_SIZE,
        categoryId: filters.categoryId || undefined,
        linkedEntityType: filters.linkedEntityType || undefined,
        includeArchived: filters.includeArchived,
      });
      setDocuments(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [pageNumber, filters.categoryId, filters.linkedEntityType, filters.includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<DocumentFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    documents,
    page,
    loading,
    error,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseDocumentReturn {
  document: Document | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  update: (
    input: Omit<documentService.UpdateDocumentInput, 'documentId' | 'clientRequestId'>,
  ) => Promise<void>;
  archive: (reason: string) => Promise<void>;
  /** Attach a new file to this document (increments its versionNo server-side). */
  uploadFile: (input: Omit<
    documentService.UploadDocumentInput,
    'documentId' | 'clientRequestId' | 'categoryId'
  >) => Promise<void>;
}

/** One document, plus its metadata patch, archive and re-upload operations. */
export function useDocument(documentId?: string): UseDocumentReturn {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!documentId) {
      setDocument(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDocument(await documentService.getDocument(documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the document');
      setDocument(null);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a write, then reload so the displayed values are the persisted ones. */
  const runWrite = useCallback(
    async (write: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await write();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The operation failed');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const update = useCallback(
    (input: Omit<documentService.UpdateDocumentInput, 'documentId' | 'clientRequestId'>) => {
      if (!documentId) return Promise.resolve();
      return runWrite(() =>
        documentService.updateDocument({
          ...input,
          documentId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [documentId, runWrite],
  );

  const archive = useCallback(
    (reason: string) => {
      if (!documentId) return Promise.resolve();
      return runWrite(() =>
        documentService.archiveDocument({
          documentId,
          reason,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [documentId, runWrite],
  );

  /** The category is server-validated against the document's own row, and the
   * upload route wants it, so it comes from the loaded document rather than from
   * a form field. */
  const uploadFile = useCallback(
    (
      input: Omit<
        documentService.UploadDocumentInput,
        'documentId' | 'clientRequestId' | 'categoryId'
      >,
    ) => {
      if (!documentId || !document) return Promise.resolve();
      return runWrite(() =>
        documentService.uploadDocument({
          ...input,
          documentId,
          categoryId: document.categoryId,
          clientRequestId: generateClientId(),
        }),
      );
    },
    [documentId, document, runWrite],
  );

  return { document, loading, error, busy, reload: load, update, archive, uploadFile };
}

export interface UseCreateDocumentReturn {
  creating: boolean;
  error: string | null;
  created: Document | null;
  create: (
    input: Omit<documentService.CreateDocumentInput, 'clientRequestId'>,
  ) => Promise<Document | null>;
  reset: () => void;
}

/** Metadata-only create. Returns the created row so the caller can then upload a
 * file against it (or navigate to it). */
export function useCreateDocument(): UseCreateDocumentReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Document | null>(null);

  const create = useCallback(
    async (input: Omit<documentService.CreateDocumentInput, 'clientRequestId'>) => {
      setCreating(true);
      setError(null);
      try {
        const result = await documentService.createDocument({
          ...input,
          clientRequestId: generateClientId(),
        });
        setCreated(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the document');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setCreated(null);
  }, []);

  return { creating, error, created, create, reset };
}

export interface UseUploadDocumentReturn {
  uploading: boolean;
  error: string | null;
  result: documentService.UploadDocumentResult | null;
  upload: (
    input: Omit<documentService.UploadDocumentInput, 'clientRequestId'>,
  ) => Promise<documentService.UploadDocumentResult | null>;
  reset: () => void;
}

/** The one-shot path: upload a file and let the server create the document row.
 * Used by the list page's upload action, where the user just wants the file in. */
export function useUploadDocument(): UseUploadDocumentReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<documentService.UploadDocumentResult | null>(null);

  const upload = useCallback(
    async (input: Omit<documentService.UploadDocumentInput, 'clientRequestId'>) => {
      setUploading(true);
      setError(null);
      try {
        const uploaded = await documentService.uploadDocument({
          ...input,
          clientRequestId: generateClientId(),
        });
        setResult(uploaded);
        return uploaded;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The file could not be uploaded');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { uploading, error, result, upload, reset };
}

/** Read a browser `File` into raw base64 (no `data:` prefix) for `documents.upload`.
 *
 * This is the ONLY place the frontend touches file bytes — everything else is
 * metadata. It is deliberately a plain promise helper rather than a hook: the
 * upload modals call it once per submit. */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const raw = reader.result;
      if (typeof raw !== 'string') {
        reject(new Error(`Could not read ${file.name}`));
        return;
      }
      /* `readAsDataURL` yields `data:<mime>;base64,<payload>`; the Drive write
       * wants only the payload. */
      resolve(documentService.stripDataUrlPrefix(raw));
    };
    reader.readAsDataURL(file);
  });
}
