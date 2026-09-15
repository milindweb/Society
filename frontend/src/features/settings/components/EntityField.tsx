/* EntityField.tsx — FE-13 generic field renderer
 *
 * Renders one `ConfigEntityField` descriptor as the right input. This single
 * component is what makes the Settings UI metadata-driven: a new master entity
 * added to `SchemaMeta.MASTER_ENTITIES` needs no frontend change at all.
 *
 * The mapping is deliberately total — every declared `type` maps to an input,
 * and an unknown type falls back to a text input rather than rendering nothing,
 * so a backend that adds a type before the frontend knows about it still
 * produces a usable (if plain) form. */

import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import * as configService from '@/services/configService';
import type { ConfigEntity, ConfigEntityField } from '@/types/domain';

export interface EntityFieldProps {
  field: ConfigEntityField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  /** Server-reported message for this column, from a VALIDATION_ERROR. */
  error?: string;
  disabled?: boolean;
  /** Descriptors for every entity, so a `reference` can find its target's
   * id/label columns. */
  catalog: ConfigEntity[];
  options: { value: string; label: string }[];
  optionsLoading?: boolean;
}

export function EntityField({
  field,
  value,
  onChange,
  error,
  disabled = false,
  catalog,
  options,
  optionsLoading = false,
}: EntityFieldProps) {
  const hint = field.max ? `Max ${field.max} characters` : undefined;
  const label = field.label || field.key;

  /* A checkbox owns its own label — wrapping it in a FormField would duplicate
   * it. It also has no concept of an empty value, so it is handled first. */
  if (field.type === 'checkbox') {
    return (
      <div className="hs-field">
        <Checkbox
          label={label}
          checked={configService.isTruthy(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.key, event.target.checked)}
        />
        {error && <span className="hs-field__error">{error}</span>}
      </div>
    );
  }

  const inputId = `entity-field-${field.key}`;

  if (field.type === 'textarea') {
    return (
      <FormField label={label} required={field.required} error={error} hint={hint}>
        <Textarea
          id={inputId}
          value={stringValue(value)}
          maxLength={field.max}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </FormField>
    );
  }

  if (configService.isEnumField(field) || configService.isEntityBackedField(field)) {
    /* The placeholder names what is being selected. For a reference we know the
     * target entity, so name it ("Select Charge type"); for an enum or an
     * entity-backed select the field label already reads as a noun, so it is
     * used as-is. */
    const target = field.ref ? configService.findEntityMeta(catalog, field.ref) : undefined;
    const placeholder = field.required
      ? `Select ${(target?.label ?? label).toLowerCase()}`
      : '— None —';
    return (
      <FormField
        label={label}
        required={field.required}
        error={error}
        hint={optionsLoading ? 'Loading options…' : undefined}
      >
        <Select
          id={inputId}
          aria-label={label}
          value={stringValue(value)}
          disabled={disabled || optionsLoading}
          options={options}
          placeholder={placeholder}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </FormField>
    );
  }

  if (configService.isNumericField(field)) {
    return (
      <FormField
        label={label}
        required={field.required}
        error={error}
        hint={field.type === 'percent' ? 'Enter a percentage value, e.g. 18' : undefined}
      >
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step={field.type === 'percent' ? '0.01' : 'any'}
          value={stringValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </FormField>
    );
  }

  if (field.type === 'date') {
    return (
      <FormField label={label} required={field.required} error={error}>
        <Input
          id={inputId}
          type="date"
          value={stringValue(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </FormField>
    );
  }

  /* text, phone, email and any future type share one path. */
  const inputType =
    field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : 'text';

  return (
    <FormField label={label} required={field.required} error={error} hint={hint}>
      <Input
        id={inputId}
        type={inputType}
        value={stringValue(value)}
        maxLength={field.max}
        disabled={disabled}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </FormField>
  );
}

/** `value` arrives from a sheet row as a string, from a form model as whatever
 * the last edit set, and occasionally as a number. Inputs need a string. */
function stringValue(value: unknown): string {
  if (value === null || value === undefined) { return ''; }
  return String(value);
}
