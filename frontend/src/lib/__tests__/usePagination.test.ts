/* usePagination.test.ts — Tests for usePagination hook */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '@/lib/usePagination';

describe('usePagination', () => {
  it('initializes with default page 1 and pageSize 25', () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 25 });
  });

  it('initializes with custom default page size', () => {
    const { result } = renderHook(() => usePagination(50));
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 50 });
  });

  it('setPage updates page', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.pagination.page).toBe(3);
  });

  it('setPage clamps to minimum of 1', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPage(0);
    });
    expect(result.current.pagination.page).toBe(1);
  });

  it('setPage allows negative values to be clamped to 1', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPage(-5);
    });
    expect(result.current.pagination.page).toBe(1);
  });

  it('setPageSize updates pageSize and resets to page 1', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPage(5);
    });
    act(() => {
      result.current.setPageSize(50);
    });
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 50 });
  });

  it('nextPage increments page', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.pagination.page).toBe(2);
  });

  it('prevPage decrements page', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPage(3);
    });
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.pagination.page).toBe(2);
  });

  it('prevPage does not go below 1', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.pagination.page).toBe(1);
  });

  it('reset restores initial state', () => {
    const { result } = renderHook(() => usePagination(50));
    act(() => {
      result.current.setPage(10);
      result.current.setPageSize(100);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 50 });
  });

  it('reset restores default page size 25', () => {
    const { result } = renderHook(() => usePagination());
    act(() => {
      result.current.setPageSize(100);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 25 });
  });
});
