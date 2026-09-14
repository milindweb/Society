/* csv.test.ts — Tests for CSV export helpers */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toCSVRow, generateCSV, downloadCSV } from '@/lib/csv';

describe('toCSVRow', () => {
  it('joins simple values with commas', () => {
    expect(toCSVRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('handles numbers', () => {
    expect(toCSVRow([1, 2, 3])).toBe('1,2,3');
  });

  it('handles booleans', () => {
    expect(toCSVRow([true, false])).toBe('true,false');
  });

  it('handles null and undefined as empty', () => {
    expect(toCSVRow([null, undefined, 'x'])).toBe(',,x');
  });

  it('wraps values containing commas in double quotes', () => {
    expect(toCSVRow(['hello, world'])).toBe('"hello, world"');
  });

  it('escapes double quotes by doubling them', () => {
    expect(toCSVRow(['say "hello"'])).toBe('"say ""hello"""');
  });

  it('wraps values containing newlines in double quotes', () => {
    expect(toCSVRow(['line1\nline2'])).toBe('"line1\nline2"');
  });

  it('handles empty array', () => {
    expect(toCSVRow([])).toBe('');
  });

  it('handles single value', () => {
    expect(toCSVRow(['hello'])).toBe('hello');
  });
});

describe('generateCSV', () => {
  it('generates CSV with headers and rows', () => {
    const csv = generateCSV(['Name', 'Age'], [['Alice', 30], ['Bob', 25]]);
    expect(csv).toBe('Name,Age\nAlice,30\nBob,25');
  });

  it('handles empty rows', () => {
    const csv = generateCSV(['Col1'], []);
    expect(csv).toBe('Col1');
  });

  it('handles empty headers', () => {
    const csv = generateCSV([], [['a', 'b']]);
    expect(csv).toBe('\na,b');
  });
});

describe('downloadCSV', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    createObjectURLSpy = vi.fn(() => 'blob:mock-url');
    revokeObjectURLSpy = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });

    const mockLink = {
      href: '',
      download: '',
      click: clickSpy,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a blob and triggers download', () => {
    downloadCSV('test.csv', 'col1,col2\nval1,val2');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });
});
