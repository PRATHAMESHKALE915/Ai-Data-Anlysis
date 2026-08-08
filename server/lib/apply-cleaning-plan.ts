// apply-cleaning-plan.ts
//
// AI only produces the PLAN (see data-cleaning-system-prompt.md).
// This file APPLIES that plan to every row, deterministically, so the same
// input always produces the same output — no more "AI rewrote row 4
// differently than row 17" inconsistency.

export interface CleaningPlan {
  column_analysis: {
    column: string;
    detected_type: string;
    issues_found: string[];
    suggested_action: string;
    reasoning: string;
  }[];
  text_case_plan: { column: string; case_style: 'title' | 'sentence' | 'lower' | 'upper' | 'preserve' }[];
  excluded_from_case_transform: string[];
  duplicate_groups: { canonical_row_index: number; duplicate_row_indices: number[]; reason: string }[];
  suspicious_duplicates: { row_indices: number[]; shared_field: string; reason: string }[];
  date_columns: { column: string; detected_formats: string[]; target_format: string }[];
  near_empty_rows: {
    row_index: number;
    non_null_field_count: number;
    total_fields: number;
    recommendation: 'drop' | 'keep_and_impute';
  }[];
  categorical_label_groups: { column: string; canonical_value: string; variant_values: string[] }[];
  numeric_imputation: { column: string; strategy: 'median' | 'mean'; value: number; reasoning: string }[];
  outliers: { row_index: number; column: string; value: string; reason: string }[];
  human_summary: string;
}

export interface CleaningAction {
  action: string;
  column: string;
  rows_affected: number;
  before_example: string;
  after_example: string;
}

export interface ApplyPlanResult {
  cleanedRows: Record<string, any>[];
  actions: CleaningAction[];
}

// ---------- deterministic text/date helpers ----------

/** Proper Title Case, word-by-word, hyphen-aware. "non-stick pan" -> "Non-Stick Pan" */
export function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join('-')
    )
    .join(' ');
}

export function toSentenceCase(input: string): string {
  const lower = input.toLowerCase();
  return lower.length > 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
}

export function applyCaseStyle(value: string, style: 'title' | 'sentence' | 'lower' | 'upper' | 'preserve'): string {
  const trimmed = value.trim();
  switch (style) {
    case 'title':
      return toTitleCase(trimmed);
    case 'sentence':
      return toSentenceCase(trimmed);
    case 'lower':
      return trimmed.toLowerCase();
    case 'upper':
      return trimmed.toUpperCase();
    case 'preserve':
    default:
      return trimmed;
  }
}

/** Parses common messy date formats and returns YYYY-MM-DD, or null if unparseable. */
export function normalizeDateToISO(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // DD/MM/YYYY
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return toISO(m[3], m[2], m[1]);

  // DD-MM-YYYY
  m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return toISO(m[3], m[2], m[1]);

  // MM/DD/YYYY fallback
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month <= 12 && day <= 31) {
      return toISO(m[3], m[1], m[2]);
    }
  }

  return null; // unparseable — leave to the "needs review" bucket, don't guess
}

function toISO(year: string, month: string, day: string): string {
  const mm = month.padStart(2, '0');
  const dd = day.padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function normalizeForComparison(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------- main pipeline ----------

export function applyCleaningPlan(
  rawRows: Record<string, any>[],
  plan: CleaningPlan
): ApplyPlanResult {
  const actions: CleaningAction[] = [];
  let rows = rawRows.map((r) => ({ ...r })); // shallow clone, never mutate input

  // 1. Drop near-empty rows the plan recommends dropping
  const dropIndices = new Set(
    (plan.near_empty_rows || []).filter((r) => r.recommendation === 'drop').map((r) => r.row_index)
  );
  if (dropIndices.size > 0) {
    rows = rows.filter((_, idx) => !dropIndices.has(idx));
    actions.push({
      action: 'Dropped rows that were almost entirely empty',
      column: '(entire row)',
      rows_affected: dropIndices.size,
      before_example: '<mostly blank row>',
      after_example: '(removed)',
    });
  }

  // 2. Remove exact duplicate rows (keep the first occurrence in each group)
  let duplicatesRemoved = 0;
  const allDuplicateIndicesToRemove = new Set<number>();
  for (const group of plan.duplicate_groups || []) {
    for (const idx of group.duplicate_row_indices || []) {
      if (idx !== group.canonical_row_index) allDuplicateIndicesToRemove.add(idx);
    }
  }
  if (allDuplicateIndicesToRemove.size > 0) {
    // indices from the plan refer to positions in rawRows — remap against
    // rows already filtered above by tracking original indices.
    const survivingOriginalIndices = rawRows
      .map((_, idx) => idx)
      .filter((idx) => !dropIndices.has(idx));
    const keepMask = survivingOriginalIndices.map((origIdx) => !allDuplicateIndicesToRemove.has(origIdx));
    rows = rows.filter((_, i) => keepMask[i]);
    duplicatesRemoved = allDuplicateIndicesToRemove.size;
    actions.push({
      action: 'Removed exact duplicate rows (kept first occurrence)',
      column: '(entire row)',
      rows_affected: duplicatesRemoved,
      before_example: 'duplicate row',
      after_example: '(removed)',
    });
  }

  // 3. Apply text casing per column (skipping excluded columns)
  for (const { column, case_style } of plan.text_case_plan || []) {
    if ((plan.excluded_from_case_transform || []).includes(column)) continue;
    let changedCount = 0;
    let beforeSample = '';
    let afterSample = '';
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== 'string' || val.trim() === '') return row;
      const cleaned = applyCaseStyle(val, case_style);
      if (cleaned !== val) {
        changedCount++;
        if (!beforeSample) {
          beforeSample = val;
          afterSample = cleaned;
        }
      }
      return { ...row, [column]: cleaned };
    });
    if (changedCount > 0) {
      actions.push({
        action: `Standardized "${column}" to ${case_style} case`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: afterSample,
      });
    }
  }

  // 3b. Emails and other excluded columns: trim + lowercase only, never case-transform
  for (const column of plan.excluded_from_case_transform || []) {
    let changedCount = 0;
    let beforeSample = '';
    let afterSample = '';
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== 'string' || val.trim() === '') return row;
      const isEmailLike = /@/.test(val);
      const cleaned = isEmailLike ? val.trim().toLowerCase() : val.trim();
      if (cleaned !== val) {
        changedCount++;
        if (!beforeSample) {
          beforeSample = val;
          afterSample = cleaned;
        }
      }
      return { ...row, [column]: cleaned };
    });
    if (changedCount > 0) {
      actions.push({
        action: `Normalized "${column}" (trimmed${/@/.test(rows[0]?.[column] ?? '') ? ', lowercased' : ''}, casing preserved)`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: afterSample,
      });
    }
  }

  // 4. Normalize date columns to ISO
  for (const { column } of plan.date_columns || []) {
    let changedCount = 0;
    let beforeSample = '';
    let afterSample = '';
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== 'string' || val.trim() === '') return row;
      const iso = normalizeDateToISO(val);
      if (iso && iso !== val) {
        changedCount++;
        if (!beforeSample) {
          beforeSample = val;
          afterSample = iso;
        }
        return { ...row, [column]: iso };
      }
      return row;
    });
    if (changedCount > 0) {
      actions.push({
        action: `Normalized "${column}" to YYYY-MM-DD`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: afterSample,
      });
    }
  }

  // 5. Canonicalize categorical label variants (e.g. "Non stick pan" -> "Non-Stick Pan")
  for (const { column, canonical_value, variant_values } of plan.categorical_label_groups || []) {
    const variantSet = new Set((variant_values || []).map(normalizeForComparison));
    let changedCount = 0;
    let beforeSample = '';
    rows = rows.map((row) => {
      const val = row[column];
      if (typeof val !== 'string') return row;
      if (variantSet.has(normalizeForComparison(val)) && val !== canonical_value) {
        changedCount++;
        if (!beforeSample) beforeSample = val;
        return { ...row, [column]: canonical_value };
      }
      return row;
    });
    if (changedCount > 0) {
      actions.push({
        action: `Merged inconsistent labels in "${column}" into "${canonical_value}"`,
        column,
        rows_affected: changedCount,
        before_example: beforeSample,
        after_example: canonical_value,
      });
    }
  }

  // 6. Numeric imputation (median/mean as decided by the plan)
  for (const { column, strategy, value } of plan.numeric_imputation || []) {
    let changedCount = 0;
    rows = rows.map((row) => {
      const val = row[column];
      const isBlank = val === null || val === undefined || String(val).trim() === '';
      if (!isBlank) return row;
      changedCount++;
      return { ...row, [column]: value };
    });
    if (changedCount > 0) {
      actions.push({
        action: `Filled missing "${column}" values using column ${strategy}`,
        column,
        rows_affected: changedCount,
        before_example: '(blank)',
        after_example: String(value),
      });
    }
  }

  return { cleanedRows: rows, actions };
}

/**
 * Recomputes a strategy value (median/mean) directly from the actual dataset,
 * instead of trusting whatever number the AI put in the plan. Use this before
 * calling applyCleaningPlan so imputed values are always mathematically correct.
 */
export function recomputeNumericStrategyValues(
  rows: Record<string, any>[],
  imputationPlan: { column: string; strategy: 'median' | 'mean' }[]
): { column: string; strategy: 'median' | 'mean'; value: number; reasoning: string }[] {
  return (imputationPlan || []).map(({ column, strategy }) => {
    const nums = rows
      .map((r) => r[column])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
      .map((v) => Number(v))
      .filter((n) => !Number.isNaN(n));

    const value =
      strategy === 'median' ? median(nums) : nums.reduce((a, b) => a + b, 0) / (nums.length || 1);

    return {
      column,
      strategy,
      value: Math.round(value * 100) / 100,
      reasoning: `Recomputed exact ${strategy} (${Math.round(value * 100) / 100}) from non-null column values.`,
    };
  });
}
