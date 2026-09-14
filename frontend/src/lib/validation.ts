/* validation.ts — Client-side validation helpers */

export interface ValidationRule {
  test: (value: unknown) => boolean;
  message: string;
}

export function required(message = 'This field is required'): ValidationRule {
  return {
    test: (v) => v !== undefined && v !== null && v !== '',
    message,
  };
}

export function minLength(min: number, message?: string): ValidationRule {
  return {
    test: (v) => typeof v === 'string' && v.length >= min,
    message: message ?? `Must be at least ${min} characters`,
  };
}

export function maxLength(max: number, message?: string): ValidationRule {
  return {
    test: (v) => typeof v === 'string' && v.length <= max,
    message: message ?? `Must be at most ${max} characters`,
  };
}

export function pattern(regex: RegExp, message: string): ValidationRule {
  return {
    test: (v) => typeof v === 'string' && regex.test(v),
    message,
  };
}

export function isEmail(message = 'Invalid email address'): ValidationRule {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

export function isMobile(message = 'Invalid mobile number'): ValidationRule {
  return pattern(/^[6-9]\d{9}$/, message);
}

export function minNumber(min: number, message?: string): ValidationRule {
  return {
    test: (v) => typeof v === 'number' && v >= min,
    message: message ?? `Must be at least ${min}`,
  };
}

export function validate(value: unknown, rules: ValidationRule[]): string | undefined {
  for (const rule of rules) {
    if (!rule.test(value)) return rule.message;
  }
  return undefined;
}

export type FormErrors = Record<string, string>;

export function mapServerErrors(
  details: { field: string; message: string }[],
): FormErrors {
  const errors: FormErrors = {};
  for (const d of details) {
    errors[d.field] = d.message;
  }
  return errors;
}
