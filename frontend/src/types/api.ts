/* api.ts — API envelope, error codes, and contract types (api-contract.md §2, §4) */

export interface ApiEnvelope<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: ApiError;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiEnvelope<T> | ApiErrorEnvelope;

export interface ApiMeta {
  requestId: string;
  ts: string;
  schemaVersion: number;
  appVersion: string;
  duplicate?: boolean;
  page?: PageMeta;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNKNOWN_ACTION'
  | 'METHOD_NOT_ALLOWED'
  | 'SCHEMA_OUT_OF_DATE'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'ACCOUNT_LOCKED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT_ERROR'
  | 'DEPENDENCY_EXISTS'
  | 'DUPLICATE_REQUEST'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export interface Paginated<T> {
  items: T[];
  page: PageMeta;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string>;
  includeArchived?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ApiRequest {
  action: string;
  payload?: Record<string, any>;
  token?: string;
  clientRequestId?: string;
}

export function toPayload(data: Record<string, unknown>): Record<string, unknown> {
  return data;
}

export class ApiClientError extends Error {
  code: ErrorCode;
  details?: FieldError[];

  constructor(code: ErrorCode, message: string, details?: FieldError[]) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
  }
}
