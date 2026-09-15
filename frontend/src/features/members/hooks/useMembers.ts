/* useMembers.ts — Members state hook (FE-05)
 * frontend-architecture.md §1: hooks own data access; pages never fetch. */

import { useState, useCallback, useEffect } from 'react';
import * as memberService from '@/services/memberService';
import type { Member } from '@/types/domain';
import type { PageMeta } from '@/types/api';

const EMPTY_PAGE: PageMeta = {
  page: 1, pageSize: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export interface MemberListFilters {
  search?: string;
  flatId?: string;
  relationType?: string;
  statusKey?: string;
}

export interface UseMemberListReturn {
  members: Member[];
  page: PageMeta;
  loading: boolean;
  error: string | null;
  filters: MemberListFilters;
  setFilters: (next: Partial<MemberListFilters>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export function useMemberList(initial?: MemberListFilters): UseMemberListReturn {
  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPageState] = useState<PageMeta>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<MemberListFilters>(initial ?? {});
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await memberService.listMembers({
        page: pageNumber,
        pageSize: page.pageSize || 25,
        search: filters.search,
        flatId: filters.flatId,
        relationType: filters.relationType,
        statusKey: filters.statusKey,
      });
      setMembers(result.items);
      setPageState(result.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [
    pageNumber,
    page.pageSize,
    filters.search,
    filters.flatId,
    filters.relationType,
    filters.statusKey,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: Partial<MemberListFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPageNumber(1);
  }, []);

  return {
    members,
    page,
    loading,
    error,
    filters,
    setFilters,
    setPage: setPageNumber,
    reload: load,
  };
}

export interface UseMemberReturn {
  member: Member | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useMember(memberId?: string): UseMemberReturn {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMember(await memberService.getMember(memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { member, loading, error, reload: load };
}
