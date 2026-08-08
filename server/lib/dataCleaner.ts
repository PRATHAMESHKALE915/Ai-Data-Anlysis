import { GoogleGenAI } from "@google/genai";
import Papa from "papaparse";
import {
  CleaningPlan,
  applyCleaningPlan,
  recomputeNumericStrategyValues,
} from "./apply-cleaning-plan";

export interface ColumnAnalysis {
  column: string;
  detected_type: string;
  issues_found: string[];
  suggested_action: string;
  reasoning: string;
}

export interface DuplicateRowsInfo {
  count: number;
  row_indices: number[];
  strategy: string;
}

export interface OutlierInfo {
  row_index: number;
  column: string;
  value: string;
  reason: string;
  flagged_type?: string;
}

export interface CleaningActionInfo {
  action: string;
  column: string;
  rows_affected: number;
  before_example: string;
  after_example: string;
}

export interface CleaningReport {
  column_analysis: ColumnAnalysis[];
  duplicate_rows: DuplicateRowsInfo;
  outliers: OutlierInfo[];
  cleaning_actions: CleaningActionInfo[];
  human_summary: string;
  initial_row_count: number;
  final_row_count: number;
}

export interface CleanDataResult {
  cleanedCsv: string;
  rawPreview: Record<string, any>[];
  cleanedPreview: Record<string, any>[];
  report: CleaningReport;
}

/**
 * Clean data programmatically using AI plan generation from Gemini
 * followed by deterministic execution across all rows.
 */
export async function cleanDataWithAi(
  csvContent: string,
  fileName: string = "dataset.csv",
  userApprovedOutlierIndices?: number[]
): Promise<CleanDataResult> {
  // 1. Parse CSV reliably using PapaParse
  const parsed = Papa.parse<Record<string, any>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rawRows: Record<string, any>[] = parsed.data || [];
  const columns = parsed.meta.fields || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);

  if (rawRows.length === 0 || columns.length === 0) {
    throw new Error("Uploaded CSV is empty or invalid.");
  }

  const rawPreview = rawRows.slice(0, 15);
  const totalRows = rawRows.length;

  // 2. Gather dataset statistics & sample for Gemini analysis
  const colStats = columns.map((col) => {
    let nullCount = 0;
    const values: string[] = [];
    const numValues: number[] = [];

    rawRows.forEach((row) => {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === "") {
        nullCount++;
      } else {
        const strVal = String(val).trim();
        values.push(strVal);
        const cleanNumStr = strVal.replace(/[,$£€%]/g, "");
        const num = parseFloat(cleanNumStr);
        if (!isNaN(num) && isFinite(num)) {
          numValues.push(num);
        }
      }
    });

    const isNumeric = numValues.length > values.length * 0.5;
    let min: number | null = null;
    let max: number | null = null;
    let mean: number | null = null;
    let median: number | null = null;

    if (numValues.length > 0) {
      numValues.sort((a, b) => a - b);
      min = numValues[0];
      max = numValues[numValues.length - 1];
      const sum = numValues.reduce((a, b) => a + b, 0);
      mean = parseFloat((sum / numValues.length).toFixed(2));
      const mid = Math.floor(numValues.length / 2);
      median = numValues.length % 2 !== 0 ? numValues[mid] : (numValues[mid - 1] + numValues[mid]) / 2;
    }

    const uniqueVals = Array.from(new Set(values));

    return {
      column: col,
      null_count: nullCount,
      null_pct: parseFloat(((nullCount / totalRows) * 100).toFixed(1)),
      distinct_count: uniqueVals.length,
      sample_values: uniqueVals.slice(0, 8),
      inferred_type: isNumeric ? "numeric" : "text/categorical",
      numeric_stats: isNumeric ? { min, max, mean, median } : null,
    };
  });

  const sampleRows = rawRows.slice(0, 50);

  // 3. Call Gemini API for Structured AI Auto-Clean Plan
  const apiKey = process.env.GEMINI_API_KEY;
  let plan: CleaningPlan | null = null;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const systemInstruction = `You are a data-quality analyst. You will be given a dataset's column names, inferred
types, per-column null counts, basic numeric stats (min/max/mean/median), and a sample
of rows. Your job is ONLY to analyze and output a cleaning PLAN as JSON. You must NOT
rewrite, reformat, or "fix" any actual row values yourself — a separate deterministic
process will apply your plan to the full dataset. Output nothing except valid JSON
matching the schema below. No markdown fences, no preamble, no explanation text outside
the JSON.

RULES YOU MUST FOLLOW WHEN BUILDING THE PLAN:

1. TEXT CASING
   - For each text column, decide a case_style: "title" | "sentence" | "lower" |
     "upper" | "preserve".
   - Columns that look like emails, URLs, IDs, codes, or free-form notes must always
     get case_style "preserve" (or "lower" for emails specifically) — NEVER "title".
     List every such column explicitly in \`excluded_from_case_transform\`.
   - Do not attempt to perform the casing yourself. Just decide the style per column.

2. DUPLICATE ROWS
   - Distinguish TWO kinds of duplication:
     a) EXACT duplicates: every column matches except an auto-increment ID column.
        These go in \`duplicate_groups\` with strategy "keep_first_remove_rest".
     b) SUSPICIOUS-but-not-exact duplicates: e.g. same email/phone reused across
        different customer names, or same product+price+date but different name.
        These must NOT be auto-removed. List them in \`suspicious_duplicates\` with a
        reason, so the user can review them manually — do not merge or drop them.
   - Base exact-duplicate comparison on normalized values (trimmed, case-folded),
     not raw string equality, so "Mumbai" and "mumbai " count as the same value.

3. DATES
   - For each date-like column, detect every distinct format pattern present
     (e.g. "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY") and list them in
     \`detected_formats\`. Set \`target_format\` to "YYYY-MM-DD" (ISO 8601) always.
   - Do not convert the dates yourself — just report what formats exist.

4. NEAR-EMPTY ROWS
   - For every row, if fewer than 40% of its columns have a non-null value, add it to
     \`near_empty_rows\` with recommendation "drop". Do NOT recommend partially filling
     placeholder values ("Unknown", column means, etc.) into a row this empty — a row
     with almost nothing in it usually shouldn't survive cleaning at all.
   - If a row has some real data but is missing a few fields, recommend
     "keep_and_impute" instead, and let the standard imputation rules below apply
     only to that row's actual missing fields.

5. CATEGORICAL / LABEL VARIANTS
   - For any column with repeated categorical-style values (product names, categories,
     cities, etc.), detect near-duplicate labels that mean the same thing after
     normalizing case/whitespace/hyphenation (e.g. "Non-Stick Pan" vs "Non stick pan").
   - Group them under \`categorical_label_groups\`, picking ONE canonical form per group
     (prefer the most frequent variant, or the properly-formatted one if frequencies tie).

6. NUMERIC IMPUTATION
   - For each numeric column with missing values, choose "median" as the default
     strategy whenever the column contains any extreme outliers (values more than
     ~3x the median or negative where negative is implausible for that column, e.g.
     price/quantity can't be negative). Use "mean" only when the column looks
     roughly symmetric with no extreme outliers.
   - Report the actual numeric value to fill, and your reasoning.

7. OUTLIERS
   - Flag implausible values (negative prices, quantities wildly above the rest of the
     column, ratings outside a plausible scale, etc.) in \`outliers\`. These are NEVER
     auto-removed — only flagged for the user to approve individually.

8. Do not invent columns, values, or rows that are not implied by the input data.
   If you are not confident about a rule for a column, omit that column from the
   relevant plan section rather than guessing.

OUTPUT JSON SCHEMA (return exactly this shape, no extra top-level keys):

{
  "column_analysis": [
    { "column": string, "detected_type": string, "issues_found": string[],
      "suggested_action": string, "reasoning": string }
  ],
  "text_case_plan": [
    { "column": string, "case_style": "title"|"sentence"|"lower"|"upper"|"preserve" }
  ],
  "excluded_from_case_transform": string[],
  "duplicate_groups": [
    { "canonical_row_index": number, "duplicate_row_indices": number[], "reason": string }
  ],
  "suspicious_duplicates": [
    { "row_indices": number[], "shared_field": string, "reason": string }
  ],
  "date_columns": [
    { "column": string, "detected_formats": string[], "target_format": "YYYY-MM-DD" }
  ],
  "near_empty_rows": [
    { "row_index": number, "non_null_field_count": number, "total_fields": number,
      "recommendation": "drop"|"keep_and_impute" }
  ],
  "categorical_label_groups": [
    { "column": string, "canonical_value": string, "variant_values": string[] }
  ],
  "numeric_imputation": [
    { "column": string, "strategy": "median"|"mean", "value": number, "reasoning": string }
  ],
  "outliers": [
    { "row_index": number, "column": string, "value": string, "reason": string }
  ],
  "human_summary": string
}`;

      const userPrompt = `Dataset File: ${fileName}
Total Rows: ${totalRows}

Column Statistics:
${JSON.stringify(colStats, null, 2)}

Sample Data Rows (First ${sampleRows.length}):
${JSON.stringify(sampleRows, null, 2)}`;

      const candidateModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-3.6-flash",
      ];

      let response: any = null;
      for (const model of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          });
          if (response && response.text) break;
        } catch (err) {
          console.warn(`[dataCleaner] Model ${model} failed, trying next candidate:`, err);
        }
      }

      const responseText = response?.text || "";
      const cleanedJsonText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      if (cleanedJsonText) {
        plan = JSON.parse(cleanedJsonText) as CleaningPlan;
      }
    } catch (err) {
      console.error("[dataCleaner] Gemini API call failed, falling back to heuristic plan:", err);
    }
  }

  // Fallback defaults if AI call is unavailable or failed
  if (!plan) {
    const textCasePlan: { column: string; case_style: 'title' | 'sentence' | 'lower' | 'upper' | 'preserve' }[] = [];
    const excludedFromCase: string[] = [];
    const dateCols: { column: string; detected_formats: string[]; target_format: string }[] = [];
    const numericImp: { column: string; strategy: 'median' | 'mean'; value: number; reasoning: string }[] = [];

    colStats.forEach((cs) => {
      const colLower = cs.column.toLowerCase();
      if (cs.inferred_type === "numeric") {
        if (cs.null_count > 0 && cs.numeric_stats?.median !== undefined) {
          numericImp.push({
            column: cs.column,
            strategy: "median",
            value: cs.numeric_stats.median,
            reasoning: "Heuristic fallback selected column median.",
          });
        }
      } else {
        if (colLower.includes("email") || colLower.includes("url") || colLower.includes("id")) {
          excludedFromCase.push(cs.column);
        } else if (colLower.includes("date") || colLower.includes("time")) {
          dateCols.push({ column: cs.column, detected_formats: ["unknown"], target_format: "YYYY-MM-DD" });
          excludedFromCase.push(cs.column);
        } else {
          textCasePlan.push({ column: cs.column, case_style: "title" });
        }
      }
    });

    plan = {
      column_analysis: colStats.map((cs) => ({
        column: cs.column,
        detected_type: cs.inferred_type,
        issues_found: cs.null_count > 0 ? [`${cs.null_count} missing values`] : [],
        suggested_action: cs.inferred_type === "numeric" ? "fill_median" : "standardize_casing",
        reasoning: "Heuristic fallback generated basic column analysis.",
      })),
      text_case_plan: textCasePlan,
      excluded_from_case_transform: excludedFromCase,
      duplicate_groups: [],
      suspicious_duplicates: [],
      date_columns: dateCols,
      near_empty_rows: [],
      categorical_label_groups: [],
      numeric_imputation: numericImp,
      outliers: [],
      human_summary: "Heuristic cleaning plan created and applied.",
    };
  }

  // 4. Recompute numeric strategy values directly from actual raw data for precision
  if (plan.numeric_imputation && plan.numeric_imputation.length > 0) {
    plan.numeric_imputation = recomputeNumericStrategyValues(rawRows, plan.numeric_imputation);
  }

  // 5. Apply deterministic cleaning plan across all rows
  let { cleanedRows, actions } = applyCleaningPlan(rawRows, plan);

  // 6. Apply user-approved outlier row removals if specified
  if (userApprovedOutlierIndices && userApprovedOutlierIndices.length > 0) {
    const toRemoveSet = new Set(userApprovedOutlierIndices);
    const beforeCount = cleanedRows.length;
    cleanedRows = cleanedRows.filter((_, idx) => !toRemoveSet.has(idx));
    const removedCount = beforeCount - cleanedRows.length;

    if (removedCount > 0) {
      actions.push({
        action: "Removed user-approved outlier rows",
        column: "Flagged Rows",
        rows_affected: removedCount,
        before_example: `${removedCount} outlier row(s) approved by user`,
        after_example: "Removed",
      });
    }
  }

  // 7. Extract duplicate rows info & outliers for the report
  const duplicateIndicesToRemove: number[] = [];
  for (const group of plan.duplicate_groups || []) {
    for (const idx of group.duplicate_row_indices || []) {
      if (idx !== group.canonical_row_index) {
        duplicateIndicesToRemove.push(idx);
      }
    }
  }

  const reportOutliers: OutlierInfo[] = (plan.outliers || []).map((o) => ({
    row_index: o.row_index,
    column: o.column,
    value: o.value,
    reason: o.reason,
  }));

  // Include suspicious duplicates as review items in outliers list if any
  (plan.suspicious_duplicates || []).forEach((sd) => {
    sd.row_indices.forEach((idx) => {
      if (!reportOutliers.some((o) => o.row_index === idx)) {
        reportOutliers.push({
          row_index: idx,
          column: sd.shared_field || "row",
          value: "Suspicious duplicate",
          reason: sd.reason || "Shared key across distinct rows",
        });
      }
    });
  });

  // 8. Generate Cleaned CSV & Final Report
  const cleanedCsv = Papa.unparse(cleanedRows);
  const cleanedPreview = cleanedRows.slice(0, 15);

  const finalReport: CleaningReport = {
    column_analysis: plan.column_analysis || [],
    duplicate_rows: {
      count: duplicateIndicesToRemove.length,
      row_indices: duplicateIndicesToRemove,
      strategy: "keep_first_remove_rest",
    },
    outliers: reportOutliers,
    cleaning_actions: actions,
    human_summary: plan.human_summary || "Successfully applied AI data cleaning plan deterministically.",
    initial_row_count: rawRows.length,
    final_row_count: cleanedRows.length,
  };

  return {
    cleanedCsv,
    rawPreview,
    cleanedPreview,
    report: finalReport,
  };
}
