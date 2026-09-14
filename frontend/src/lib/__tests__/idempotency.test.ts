/* idempotency.test.ts — Tests for client ID generation */

import { describe, it, expect, vi } from 'vitest';
import { generateClientId } from '@/lib/idempotency';

describe('generateClientId', () => {
  it('returns a string', () => {
    expect(typeof generateClientId()).toBe('string');
  });

  it('returns a UUID format when crypto.randomUUID is available', () => {
    const mockUUID = '12345678-1234-4123-8123-123456789abc';
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => mockUUID) });
    expect(generateClientId()).toBe(mockUUID);
    vi.unstubAllGlobals();
  });

  it('returns a fallback UUID format when crypto is not available', () => {
    vi.stubGlobal('crypto', undefined);
    const id = generateClientId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    vi.unstubAllGlobals();
  });

  it('generates different IDs on successive calls', () => {
    const id1 = generateClientId();
    const id2 = generateClientId();
    expect(id1).not.toBe(id2);
  });

  it('returns 36-character UUID string', () => {
    vi.stubGlobal('crypto', undefined);
    const id = generateClientId();
    expect(id.length).toBe(36);
    vi.unstubAllGlobals();
  });
});
