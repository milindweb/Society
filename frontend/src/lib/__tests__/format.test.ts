/* format.test.ts — Tests for general formatting helpers */

import { describe, it, expect } from 'vitest';
import {
  truncate,
  capitalize,
  formatEnumKey,
  formatPhoneNumber,
  formatFileSize,
  joinName,
  getInitials,
} from '@/lib/format';

describe('truncate', () => {
  it('returns string unchanged if within max length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string unchanged if exactly max length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis when exceeding max length', () => {
    expect(truncate('hello world', 5)).toBe('hell…');
  });

  it('handles single character max length', () => {
    expect(truncate('ab', 1)).toBe('…');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter and lowercases rest', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles all uppercase', () => {
    expect(capitalize('HELLO')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A');
  });

  it('handles mixed case', () => {
    expect(capitalize('hELLo')).toBe('Hello');
  });
});

describe('formatEnumKey', () => {
  it('replaces underscores with spaces and capitalizes words', () => {
    expect(formatEnumKey('IN_PROGRESS')).toBe('In Progress');
  });

  it('handles single word', () => {
    expect(formatEnumKey('OPEN')).toBe('Open');
  });

  it('handles multiple underscores', () => {
    expect(formatEnumKey('A_B_C')).toBe('A B C');
  });
});

describe('formatPhoneNumber', () => {
  it('formats 10-digit number with dash', () => {
    expect(formatPhoneNumber('9876543210')).toBe('98765-43210');
  });

  it('returns input unchanged if not 10 digits', () => {
    expect(formatPhoneNumber('12345')).toBe('12345');
  });

  it('handles number with non-digit characters', () => {
    expect(formatPhoneNumber('98765-43210')).toBe('98765-43210');
  });

  it('handles 11-digit number', () => {
    expect(formatPhoneNumber('98765432101')).toBe('98765432101');
  });
});

describe('formatFileSize', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });

  it('formats fractional KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});

describe('joinName', () => {
  it('joins multiple parts with space', () => {
    expect(joinName('John', 'Doe')).toBe('John Doe');
  });

  it('filters out null and undefined', () => {
    expect(joinName('John', null, 'Doe', undefined)).toBe('John Doe');
  });

  it('handles empty array', () => {
    expect(joinName()).toBe('');
  });

  it('handles single part', () => {
    expect(joinName('John')).toBe('John');
  });

  it('filters out empty strings', () => {
    expect(joinName('John', '', 'Doe')).toBe('John Doe');
  });
});

describe('getInitials', () => {
  it('returns first two initials for two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns first two initials for multi-word name', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('returns single initial for single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('handles lowercase names', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('handles extra whitespace', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD');
  });
});
