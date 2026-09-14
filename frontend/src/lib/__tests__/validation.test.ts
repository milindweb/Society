/* validation.test.ts — Tests for client-side validation helpers */

import { describe, it, expect } from 'vitest';
import {
  required,
  minLength,
  maxLength,
  pattern,
  isEmail,
  isMobile,
  minNumber,
  validate,
  mapServerErrors,
} from '@/lib/validation';

describe('required', () => {
  it('passes for non-empty string', () => {
    expect(required().test('hello')).toBe(true);
  });

  it('fails for empty string', () => {
    expect(required().test('')).toBe(false);
  });

  it('fails for null', () => {
    expect(required().test(null)).toBe(false);
  });

  it('fails for undefined', () => {
    expect(required().test(undefined)).toBe(false);
  });

  it('passes for number 0', () => {
    expect(required().test(0)).toBe(true);
  });

  it('passes for boolean false', () => {
    expect(required().test(false)).toBe(true);
  });

  it('uses custom message', () => {
    expect(required('Custom message').message).toBe('Custom message');
  });

  it('uses default message', () => {
    expect(required().message).toBe('This field is required');
  });
});

describe('minLength', () => {
  it('passes when string meets minimum length', () => {
    expect(minLength(3).test('hello')).toBe(true);
  });

  it('fails when string is too short', () => {
    expect(minLength(5).test('hi')).toBe(false);
  });

  it('passes for exact minimum length', () => {
    expect(minLength(5).test('hello')).toBe(true);
  });

  it('fails for non-string input', () => {
    expect(minLength(3).test(123)).toBe(false);
  });

  it('uses custom message', () => {
    expect(minLength(3, 'Too short').message).toBe('Too short');
  });

  it('uses default message', () => {
    expect(minLength(3).message).toBe('Must be at least 3 characters');
  });
});

describe('maxLength', () => {
  it('passes when string is within max length', () => {
    expect(maxLength(10).test('hello')).toBe(true);
  });

  it('fails when string exceeds max length', () => {
    expect(maxLength(3).test('hello')).toBe(false);
  });

  it('passes for exact max length', () => {
    expect(maxLength(5).test('hello')).toBe(true);
  });

  it('fails for non-string input', () => {
    expect(maxLength(3).test(123)).toBe(false);
  });

  it('uses default message', () => {
    expect(maxLength(5).message).toBe('Must be at most 5 characters');
  });
});

describe('pattern', () => {
  it('passes when pattern matches', () => {
    expect(pattern(/^\d+$/, 'Digits only').test('123')).toBe(true);
  });

  it('fails when pattern does not match', () => {
    expect(pattern(/^\d+$/, 'Digits only').test('abc')).toBe(false);
  });

  it('fails for non-string input', () => {
    expect(pattern(/^\d+$/, 'Digits only').test(123)).toBe(false);
  });
});

describe('isEmail', () => {
  it('passes for valid email', () => {
    expect(isEmail().test('user@example.com')).toBe(true);
  });

  it('fails for email without @', () => {
    expect(isEmail().test('userexample.com')).toBe(false);
  });

  it('fails for email without domain', () => {
    expect(isEmail().test('user@')).toBe(false);
  });

  it('fails for email with spaces', () => {
    expect(isEmail().test('user @example.com')).toBe(false);
  });

  it('uses custom message', () => {
    expect(isEmail('Bad email').message).toBe('Bad email');
  });

  it('uses default message', () => {
    expect(isEmail().message).toBe('Invalid email address');
  });
});

describe('isMobile', () => {
  it('passes for valid 10-digit mobile starting with 6-9', () => {
    expect(isMobile().test('9876543210')).toBe(true);
  });

  it('passes for mobile starting with 6', () => {
    expect(isMobile().test('6123456789')).toBe(true);
  });

  it('fails for mobile starting with 5', () => {
    expect(isMobile().test('5123456789')).toBe(false);
  });

  it('fails for short number', () => {
    expect(isMobile().test('123456789')).toBe(false);
  });

  it('fails for long number', () => {
    expect(isMobile().test('12345678901')).toBe(false);
  });

  it('uses default message', () => {
    expect(isMobile().message).toBe('Invalid mobile number');
  });
});

describe('minNumber', () => {
  it('passes when number is above minimum', () => {
    expect(minNumber(10).test(15)).toBe(true);
  });

  it('passes when number equals minimum', () => {
    expect(minNumber(10).test(10)).toBe(true);
  });

  it('fails when number is below minimum', () => {
    expect(minNumber(10).test(5)).toBe(false);
  });

  it('fails for non-number input', () => {
    expect(minNumber(10).test('10')).toBe(false);
  });

  it('uses default message', () => {
    expect(minNumber(5).message).toBe('Must be at least 5');
  });
});

describe('validate', () => {
  it('returns undefined when all rules pass', () => {
    expect(validate('hello', [required(), minLength(3)])).toBeUndefined();
  });

  it('returns first failing rule message', () => {
    expect(validate('', [required(), minLength(3)])).toBe('This field is required');
  });

  it('returns undefined for empty rules array', () => {
    expect(validate('anything', [])).toBeUndefined();
  });

  it('returns second rule message if first passes', () => {
    expect(validate('hi', [required(), minLength(5)])).toBe('Must be at least 5 characters');
  });
});

describe('mapServerErrors', () => {
  it('maps array of error objects to a record', () => {
    const errors = mapServerErrors([
      { field: 'email', message: 'Invalid email' },
      { field: 'password', message: 'Too short' },
    ]);
    expect(errors).toEqual({
      email: 'Invalid email',
      password: 'Too short',
    });
  });

  it('returns empty object for empty array', () => {
    expect(mapServerErrors([])).toEqual({});
  });

  it('last error overwrites for duplicate fields', () => {
    const errors = mapServerErrors([
      { field: 'email', message: 'Error 1' },
      { field: 'email', message: 'Error 2' },
    ]);
    expect(errors.email).toBe('Error 2');
  });
});
