/* SocietySettingsForm.tsx — FE-13 society identity, locale and limits
 *
 * The write side of `config.get` / `config.update`. Keys are grouped the way
 * `Setup.gs:96-135` seeds them via the `groupKey` column, so the form mirrors
 * what the server actually stores rather than inventing a taxonomy.
 *
 * Every key here is seeded by `seedSocietyConfig` and cast on read by
 * `ConfigService.castConfigValue` (NUMBER → number, BOOLEAN → boolean,
 * JSON → object). That cast is why the form keeps local state as raw strings
 * for numeric fields and lets the server do the conversion — typing
 * "about 4" into a number field must not silently become 0 in the UI before
 * the server has had its say.
 *
 * No optimistic UI (SRS §23): a successful save replaces the form from the
 * server's own response, and the shared `configStore` is refreshed so the
 * currency symbol and page size update everywhere at once.
 *
 * `config.update` requires `config.write`; without it the form is read-only.
 * `isConfigured` and the identity fields are handled by `setup.complete`
 * (also `config.write`) rather than here, because that action also flips the
 * setup flag and has its own first-run flow. */

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { toastStore } from '@/state/toastStore';
import { useSocietyConfig } from '../hooks/useSettings';
import type { SocietyConfig } from '@/types/domain';

/** One field the form knows how to render.
 *
 * `group` matches the `groupKey` column in `Society_Config`. Declaring the form
 * from this table (rather than hand-writing 30 inputs) keeps the read-only and
 * edit paths identical and makes an omission obvious. */
interface ConfigFieldSpec {
  key: string;
  label: string;
  group: string;
  kind: 'text' | 'number' | 'boolean';
  hint?: string;
  /** Renders in the same row as the previous field of this group. */
  half?: boolean;
}

const CONFIG_FIELDS: ConfigFieldSpec[] = [
  /* ── IDENTITY ── */
  { key: 'societyName', label: 'Society name', group: 'IDENTITY', kind: 'text' },
  { key: 'registrationNumber', label: 'Registration number', group: 'IDENTITY', kind: 'text', half: true },
  { key: 'societyAddress', label: 'Address', group: 'IDENTITY', kind: 'text' },
  { key: 'societyEmail', label: 'Contact email', group: 'IDENTITY', kind: 'text', half: true },
  { key: 'societyPhone', label: 'Contact phone', group: 'IDENTITY', kind: 'text', half: true },
  { key: 'societyWebsite', label: 'Website', group: 'IDENTITY', kind: 'text' },

  /* ── LOCALE ── */
  { key: 'currencyCode', label: 'Currency code', group: 'LOCALE', kind: 'text', hint: 'ISO 4217, e.g. INR', half: true },
  { key: 'currencySymbol', label: 'Currency symbol', group: 'LOCALE', kind: 'text', half: true },
  { key: 'locale', label: 'Locale', group: 'LOCALE', kind: 'text', hint: 'e.g. en-IN', half: true },
  { key: 'timezone', label: 'Timezone', group: 'LOCALE', kind: 'text', hint: 'IANA name, e.g. Asia/Kolkata', half: true },
  { key: 'dateDisplayFormat', label: 'Date display format', group: 'LOCALE', kind: 'text', hint: 'e.g. DD/MM/YYYY' },

  /* ── FINANCE ── */
  { key: 'financialYearStartMonth', label: 'Financial year start month', group: 'FINANCE', kind: 'number', hint: '1–12', half: true },
  { key: 'financialYearStartDay', label: 'Financial year start day', group: 'FINANCE', kind: 'number', hint: '1–31', half: true },
  { key: 'billingDueDay', label: 'Billing due day', group: 'FINANCE', kind: 'number', hint: 'Day of month a demand falls due', half: true },
  { key: 'salaryPayDay', label: 'Salary pay day', group: 'FINANCE', kind: 'number', half: true },
  { key: 'interestEnabled', label: 'Interest enabled', group: 'FINANCE', kind: 'boolean' },
  { key: 'lateFeeEnabled', label: 'Late fee enabled', group: 'FINANCE', kind: 'boolean' },
  { key: 'interestDefaultRuleId', label: 'Default interest rule ID', group: 'FINANCE', kind: 'text', hint: 'Must match a row in Interest Rules' },
  { key: 'receiptFooterNote', label: 'Receipt footer note', group: 'FINANCE', kind: 'text' },
  { key: 'demandFooterNote', label: 'Demand footer note', group: 'FINANCE', kind: 'text' },

  /* ── HR ── */
  { key: 'attendanceWorkHours', label: 'Work hours per day', group: 'HR', kind: 'number', half: true },

  /* ── OPERATIONS ── */
  { key: 'visitorAutoExitHours', label: 'Visitor auto-exit hours', group: 'OPERATIONS', kind: 'number', half: true },

  /* ── RETENTION ── */
  { key: 'archiveAfterMonths', label: 'Archive after months', group: 'RETENTION', kind: 'number' },

  /* ── UX ── */
  { key: 'searchMinChars', label: 'Minimum search characters', group: 'UX', kind: 'number', half: true },
  { key: 'pageSizeDefault', label: 'Default page size', group: 'UX', kind: 'number', half: true },
  { key: 'pageSizeOptions', label: 'Page size options', group: 'UX', kind: 'text', hint: 'Comma-separated, e.g. 10,25,50,100' },

  /* ── SECURITY ── */
  { key: 'sessionIdleMinutes', label: 'Session idle minutes', group: 'SECURITY', kind: 'number', half: true },
  { key: 'auditRetentionMonths', label: 'Audit retention months', group: 'SECURITY', kind: 'number', half: true },
];

/** Display order and copy for the groups. Keys match `groupKey` exactly. */
const GROUP_ORDER: { key: string; title: string; description: string }[] = [
  { key: 'IDENTITY', title: 'Society identity', description: 'Name, address and contact details shown on receipts, demands and notices.' },
  { key: 'LOCALE', title: 'Locale & formatting', description: 'Currency and date presentation for the whole application.' },
  { key: 'FINANCE', title: 'Finance', description: 'Financial year, billing cycle, interest and late-fee behaviour.' },
  { key: 'HR', title: 'HR', description: 'Attendance and payroll defaults.' },
  { key: 'OPERATIONS', title: 'Operations', description: 'Day-to-day operational limits.' },
  { key: 'RETENTION', title: 'Retention', description: 'How long records are kept before archiving.' },
  { key: 'UX', title: 'Interface', description: 'Search and pagination defaults.' },
  { key: 'SECURITY', title: 'Security', description: 'Session and audit retention limits.' },
];

export interface SocietySettingsFormProps {
  /** Whether the caller holds `config.write`. */
  canWrite: boolean;
}

export function SocietySettingsForm({ canWrite }: SocietySettingsFormProps) {
  const { config, loading, error, saving, saveError, reload, save } = useSocietyConfig();
  const [model, setModel] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /* Seed the form from the server whenever the config (re)loads. Only keys we
   * actually render are copied, so a config key added on the backend without a
   * matching spec is never sent back by this form. */
  useEffect(() => {
    if (!config) { return; }
    const next: Record<string, string> = {};
    for (const field of CONFIG_FIELDS) {
      next[field.key] = stringOf(readConfigKey(config, field.key), field.kind);
    }
    setModel(next);
    setTouched({});
  }, [config]);

  const handleChange = (key: string, value: string) => {
    setModel((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  /** Send only values the user actually edited.
   *
   * `config.update` skips unknown keys silently and casts each value by its
   * stored `valueType`, so an untouched field round-tripped as a string could
   * still rewrite the sheet with an equivalent value. Sending only the diff
   * keeps the audit trail honest. */
  const changedValues = (): Record<string, unknown> => {
    const values: Record<string, unknown> = {};
    for (const field of CONFIG_FIELDS) {
      if (!touched[field.key]) { continue; }
      if (field.kind === 'boolean') {
        values[field.key] = model[field.key] === 'true';
      } else if (field.kind === 'number') {
        const raw = model[field.key] ?? '';
        /* An emptied number field is sent as-is; the server's NUMBER cast turns
         * it into 0, which is a legitimate value for these keys. */
        values[field.key] = raw === '' ? '' : Number(raw);
      } else {
        values[field.key] = model[field.key] ?? '';
      }
    }
    return values;
  };

  const dirty = Object.keys(changedValues()).length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const values = changedValues();
    if (Object.keys(values).length === 0) { return; }
    if (await save(values)) {
      toastStore.add('success', 'Configuration saved.');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="hs-text-sm hs-text-muted">Loading configuration…</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  return (
    <form onSubmit={handleSubmit}>
      {saveError && (
        <div className="hs-mb-4">
          <Alert variant="danger">
            <span>{saveError}</span>
          </Alert>
        </div>
      )}

      {!canWrite && (
        <div className="hs-mb-4">
          <Alert variant="info">
            <span>
              You have read-only access to configuration. Ask an administrator for the
              <code> config.write </code> permission to make changes.
            </span>
          </Alert>
        </div>
      )}

      {GROUP_ORDER.map((group) => {
        const fields = CONFIG_FIELDS.filter((field) => field.group === group.key);
        if (fields.length === 0) { return null; }
        return (
          <Card key={group.key} className="hs-mb-4">
            <CardHeader title={group.title} />
            <CardBody>
              <p className="hs-text-sm hs-text-muted hs-mb-4">{group.description}</p>
              <div className="hs-grid hs-grid-cols-2 hs-gap-4">
                {fields.map((field) => (
                  <div key={field.key} className={field.half ? undefined : 'hs-col-span-2'}>
                    {field.kind === 'boolean' ? (
                      <div className="hs-field">
                        <Switch
                          label={field.label}
                          checked={model[field.key] === 'true'}
                          disabled={!canWrite || saving}
                          onChange={(event) =>
                            handleChange(field.key, event.target.checked ? 'true' : 'false')
                          }
                        />
                        {field.hint && <span className="hs-field__hint">{field.hint}</span>}
                      </div>
                    ) : (
                      <FormField label={field.label} hint={field.hint}>
                        <Input
                          id={`config-${field.key}`}
                          type={field.kind === 'number' ? 'number' : 'text'}
                          inputMode={field.kind === 'number' ? 'numeric' : undefined}
                          value={model[field.key] ?? ''}
                          disabled={!canWrite || saving}
                          onChange={(event) => handleChange(field.key, event.target.value)}
                        />
                      </FormField>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        );
      })}

      {canWrite && (
        <div className="hs-flex hs-justify-end hs-gap-2 hs-mb-6">
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => {
              if (!config) { return; }
              const reset: Record<string, string> = {};
              for (const field of CONFIG_FIELDS) {
                reset[field.key] = stringOf(readConfigKey(config, field.key), field.kind);
              }
              setModel(reset);
              setTouched({});
            }}
          >
            Discard changes
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save configuration
          </Button>
        </div>
      )}
    </form>
  );
}

/** Read a config key off the typed `SocietyConfig` without an index signature.
 *
 * Several seeded keys (`societyWebsite`, `archiveAfterMonths`, …) have no field
 * on the `SocietyConfig` interface, so this reads through a narrow cast rather
 * than widening the domain type to an index signature — which would lose the
 * compile-time check on the keys that ARE typed. */
function readConfigKey(config: SocietyConfig, key: string): unknown {
  return (config as unknown as Record<string, unknown>)[key];
}

/** Booleans are stored as `'TRUE'`/`'FALSE'` strings in the sheet and cast to
 * real booleans by `config.get`; numbers arrive as numbers. The form model is
 * all strings, so both are flattened here. */
function stringOf(value: unknown, kind: ConfigFieldSpec['kind']): string {
  if (value === null || value === undefined) {
    return kind === 'boolean' ? 'false' : '';
  }
  if (kind === 'boolean') {
    return value === true || String(value).toUpperCase() === 'TRUE' ? 'true' : 'false';
  }
  return String(value);
}
