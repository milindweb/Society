/* EntityForm.tsx — FE-13 create/edit form for one master row
 *
 * Renders whatever fields the entity's descriptor declares, so a single form
 * serves all 24 master entities. Field inputs come from `EntityField`; this
 * component owns only the model, the layout and the save/error plumbing.
 *
 * No optimistic UI (SRS §23): on success the caller closes the dialog and
 * re-fetches the rows; nothing is merged into local state here. */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EntityField } from './EntityField';
import * as configService from '@/services/configService';
import { useFieldOptions } from '../hooks/useSettings';
import type { ConfigEntity, ConfigEntityField } from '@/types/domain';

export interface EntityFormProps {
  meta: ConfigEntity;
  catalog: ConfigEntity[];
  /** Edit mode seeds from this row; create mode passes `null`. */
  row: Record<string, unknown> | null;
  /** Server message from the last failed write. */
  error: string | null;
  /** Per-column messages from a VALIDATION_ERROR. */
  fieldErrors: Record<string, string>;
  busy: boolean;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

export function EntityForm({
  meta,
  catalog,
  row,
  error,
  fieldErrors,
  busy,
  onSubmit,
  onCancel,
}: EntityFormProps) {
  const [model, setModel] = useState<Record<string, unknown>>(() =>
    configService.toFormModel(meta, row),
  );

  const handleChange = (key: string, value: unknown) => {
    setModel((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(configService.toEntityValues(meta, model));
  };

  /* Required fields the user has not filled in yet — a client-side guard so the
   * obvious case does not need a round-trip. The server re-validates from the
   * same descriptors and its verdict always wins. */
  const missing = configService.requiredFields(meta).filter((field) => {
    const value = model[field.key];
    return value === '' || value === undefined || value === null;
  });
  const incomplete = missing.length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="hs-mb-4">
          <Alert variant="danger">
            <span>{error}</span>
          </Alert>
        </div>
      )}

      <div className="hs-grid hs-grid-cols-2 hs-gap-4">
        {meta.fields.map((field) => (
          <EntityFieldSlot
            key={field.key}
            field={field}
            catalog={catalog}
            value={model[field.key]}
            onChange={handleChange}
            error={fieldErrors[field.key]}
            disabled={busy}
          />
        ))}
      </div>

      {incomplete && !busy && (
        <p className="hs-field__hint hs-mt-4">
          Fill in the required fields marked with * to continue.
        </p>
      )}

      <div className="hs-flex hs-justify-end hs-gap-2 hs-mt-5">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy} disabled={incomplete}>
          {row ? 'Save changes' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

/* A separate component so `useFieldOptions` (a hook) can be called once per
 * field without breaking the rules of hooks inside the `.map()` above.
 *
 * A textarea spans both grid columns: a description squeezed into a half-width
 * cell is unreadable. */
function EntityFieldSlot(props: {
  field: ConfigEntityField;
  catalog: ConfigEntity[];
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { field, catalog, value, onChange, error, disabled } = props;

  /* Only select/reference fields need options; for everything else this hook
   * resolves to an empty list without issuing a request. */
  const { options, loading } = useFieldOptions(field, catalog);

  const wide = field.type === 'textarea';

  return (
    <div className={wide ? 'hs-col-span-2' : undefined}>
      <EntityField
        field={field}
        catalog={catalog}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
        options={options}
        optionsLoading={loading}
      />
    </div>
  );
}
