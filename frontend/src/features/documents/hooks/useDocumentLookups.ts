/* useDocumentLookups.ts — config-driven document options (FE-09)
 * SRS §9 / §15: document categories are configurable rows, never literals in the
 * source of truth. (SRS §9 lists the seeded starter set — Society Registration,
 * Bye-laws, AGM/SGM, Meeting Minutes, Audit Reports, Notices, Agreements,
 * Certificates, Bills, Vendor Documents, AMC Documents, Other — but those live in
 * the `Document_Categories` sheet, not in this file.)
 *
 * Sources, verified against backend/src/{Schema,SchemaMeta,ConfigService}.gs:
 *   Document_Categories          -> categoryId, categoryKey, categoryName,
 *                                   driveFolderKey, retentionMonths, sortOrder
 *   Status_Config DOCUMENT       -> ACTIVE, ARCHIVED, EXPIRED (`Setup.gs:68`)
 *   MASTER_ENTITIES              -> the entities a document can be linked to
 *
 * `useEntityOptions` keys on the row id, which is what `Documents.categoryId`
 * stores, so no remapping is needed here. */

import { useEntityOptions, useStatusOptions } from '@/lib/useConfigOptions';
import type { SelectOption } from '@/types/domain';

/** Document categories, from `config.entity.list('documentCategories')`. */
export function useDocumentCategoryOptions(): { options: SelectOption[]; loading: boolean } {
  const { options, loading } = useEntityOptions(
    'documentCategories',
    ['categoryId'],
    ['categoryName', 'categoryKey'],
  );
  return { options, loading };
}

/** Document statuses, from Status_Config domain DOCUMENT (ACTIVE / ARCHIVED /
 * EXPIRED). Only ACTIVE and ARCHIVED are reachable through the UI —
 * `documents.archive` is the single status transition the service exposes; an
 * EXPIRED value can only arrive from a backend job, so it is displayed, never
 * chosen. */
export function useDocumentStatusOptions(): { options: SelectOption[]; loading: boolean } {
  return useStatusOptions('DOCUMENT');
}

/** The entity types a document can be attached to (SRS §9 "Related module").
 *
 * `Documents.linkedEntityType` is free text, so the server accepts anything; this
 * list is the curated set the app itself creates documents against — decided in
 * `FE-09`. Values match the entity keys used elsewhere in the app so a future
 * "open the related record" link can resolve them.
 *
 * NOTE: this is presentation vocabulary, not business configuration — there is no
 * server-side enum for it (`SchemaMeta.ENUM_OPTIONS` has no LINKED_ENTITY_TYPE).
 * Keeping it in one exported constant means there is exactly one place to change. */
export const DOCUMENT_LINKED_ENTITY_TYPES: SelectOption[] = [
  { value: 'Member', label: 'Member' },
  { value: 'Flat', label: 'Flat' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Complaint', label: 'Complaint' },
  { value: 'Vendor', label: 'Vendor' },
  { value: 'Employee', label: 'Employee' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Payment', label: 'Payment' },
  { value: 'Notice', label: 'Notice' },
];

/** Convenience wrapper so callers use the same shape as the other lookups. */
export function useLinkedEntityTypeOptions(): { options: SelectOption[]; loading: boolean } {
  return { options: DOCUMENT_LINKED_ENTITY_TYPES, loading: false };
}
