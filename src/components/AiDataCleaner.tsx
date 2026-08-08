import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Eye,
  FileSpreadsheet,
  Table,
  Filter,
  Check,
  X,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';

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

export interface CleanDataResponse {
  cleanedCsv: string;
  rawPreview: Record<string, any>[];
  cleanedPreview: Record<string, any>[];
  report: CleaningReport;
}

interface AiDataCleanerProps {
  csvContent: string;
  fileName: string;
  cleanedCsv: string | null;
  cleaningReport: CleaningReport | null;
  onApplyCleanedCsv: (cleanedCsv: string, report: CleaningReport) => void;
  onRevertOriginal: () => void;
}

export const AiDataCleaner: React.FC<AiDataCleanerProps> = ({
  csvContent,
  fileName,
  cleanedCsv,
  cleaningReport,
  onApplyCleanedCsv,
  onRevertOriginal,
}) => {
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'side-by-side' | 'raw' | 'cleaned'>('side-by-side');
  const [selectedOutliersToRemove, setSelectedOutliersToRemove] = useState<number[]>([]);
  const [rawPreview, setRawPreview] = useState<Record<string, any>[]>([]);
  const [cleanedPreview, setCleanedPreview] = useState<Record<string, any>[]>([]);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  // Parse raw preview locally if not already done
  React.useEffect(() => {
    if (csvContent) {
      const parsed = Papa.parse<Record<string, any>>(csvContent, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.data) {
        setRawPreview(parsed.data.slice(0, 15));
      }
    }
  }, [csvContent]);

  // Handle Clean Data API trigger
  const handleCleanData = async (outliersToApply?: number[]) => {
    setIsCleaning(true);
    setError(null);
    try {
      const response = await fetch('/api/clean-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          fileName,
          userApprovedOutlierIndices: outliersToApply ?? selectedOutliersToRemove,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to clean dataset with AI');
      }

      setCleanedPreview(data.cleanedPreview);
      onApplyCleanedCsv(data.cleanedCsv, data.report);
    } catch (err: any) {
      console.error('[AiDataCleaner] Cleaning error:', err);
      setError(err?.message || 'An error occurred during AI data cleanup.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDownloadCleaned = () => {
    if (!cleanedCsv) return;
    const blob = new Blob([cleanedCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanName = fileName.replace(/\.csv$/i, '') + '-cleaned.csv';
    link.href = url;
    link.setAttribute('download', cleanName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rawColumns = rawPreview.length > 0 ? Object.keys(rawPreview[0]) : [];
  const cleanedColumns = cleanedPreview.length > 0 ? Object.keys(cleanedPreview[0]) : rawColumns;

  return (
    <div className="space-y-4">
      {/* Header Bar / Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-100 text-io-blue rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <span>AI Auto-Clean Dataset</span>
              {cleaningReport && (
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Cleaned
                </span>
              )}
            </h3>
            <p className="text-xs text-neutral-500">
              Detects &amp; fixes duplicates, missing values, inconsistent casing, improper date formats &amp; outliers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!cleaningReport ? (
            <button
              onClick={() => handleCleanData()}
              disabled={isCleaning || !csvContent}
              className="flex items-center gap-2 px-4 py-2 bg-io-blue hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isCleaning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing &amp; Cleaning...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Clean my data with AI</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleDownloadCleaned}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download cleaned CSV</span>
              </button>
              <button
                onClick={onRevertOriginal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-medium rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo / Revert to original</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-io-red rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cleaning Report Panel (When dataset is cleaned) */}
      {cleaningReport && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Human Summary Banner */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 space-y-2">
            <div className="flex items-center justify-between font-bold text-emerald-950">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>AI Data Cleaning Report Summary</span>
              </span>
              <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                {cleaningReport.initial_row_count} rows &rarr; {cleaningReport.final_row_count} rows
              </span>
            </div>
            <p className="leading-relaxed text-emerald-800 font-medium">
              {cleaningReport.human_summary}
            </p>
          </div>

          {/* Executed Actions List */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wide flex items-center justify-between">
              <span>Executed Cleaning Actions ({cleaningReport.cleaning_actions.length})</span>
              <button
                onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                className="text-[11px] text-io-blue font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                {showFullAnalysis ? (
                  <>Hide Column Deep-Dive <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Show Column Deep-Dive <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            </h4>

            <div className="grid gap-2 sm:grid-cols-2">
              {cleaningReport.cleaning_actions.map((act, i) => (
                <div key={i} className="p-3 bg-neutral-50 rounded-lg border border-neutral-100 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-neutral-800">
                    <span className="truncate">{act.action}</span>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded shrink-0">
                      {act.rows_affected} affected
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                    <span className="font-medium text-neutral-600">Column:</span>
                    <code className="bg-neutral-200/60 px-1 py-0.5 rounded text-[10px] font-mono text-neutral-800">{act.column}</code>
                  </div>
                  {act.before_example && (
                    <div className="text-[10px] font-mono text-neutral-600 flex items-center gap-1.5 pt-0.5 border-t border-neutral-200/50 mt-1">
                      <span className="line-through text-red-500">{act.before_example}</span>
                      <span>&rarr;</span>
                      <span className="text-emerald-600 font-bold">{act.after_example}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Deep-Dive Column Analysis (Expandable) */}
            {showFullAnalysis && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-3 border-t border-neutral-200 space-y-2"
              >
                <h5 className="text-[11px] font-bold text-neutral-700 uppercase">Column Diagnosis &amp; Reasoning</h5>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="p-2">Column</th>
                        <th className="p-2">Detected Type</th>
                        <th className="p-2">Issues Found</th>
                        <th className="p-2">Suggested Strategy</th>
                        <th className="p-2">Reasoning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {cleaningReport.column_analysis.map((col, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="p-2 font-mono font-medium text-neutral-900">{col.column}</td>
                          <td className="p-2 text-neutral-600 font-mono text-[10px] uppercase">{col.detected_type}</td>
                          <td className="p-2 text-neutral-700">
                            {col.issues_found.length > 0 ? (
                              col.issues_found.map((iss, j) => (
                                <span key={j} className="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-1">
                                  {iss}
                                </span>
                              ))
                            ) : (
                              <span className="text-emerald-600 font-medium">None</span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-io-blue font-semibold">{col.suggested_action}</td>
                          <td className="p-2 text-neutral-600 leading-normal">{col.reasoning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </div>

          {/* Outliers Flagged Panel with User Confirmation Checkboxes */}
          {cleaningReport.outliers.length > 0 && (
            <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-amber-950 font-bold text-xs">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Flagged Outliers &amp; Invalid Values ({cleaningReport.outliers.length})</span>
                </span>
                <span className="text-[11px] text-amber-800 font-normal">
                  Select items to drop or approve removal
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {cleaningReport.outliers.map((out, idx) => {
                  const isChecked = selectedOutliersToRemove.includes(out.row_index);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200 text-xs shadow-2xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer text-neutral-800 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOutliersToRemove([...selectedOutliersToRemove, out.row_index]);
                            } else {
                              setSelectedOutliersToRemove(selectedOutliersToRemove.filter((i) => i !== out.row_index));
                            }
                          }}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-mono text-[11px] text-amber-900 font-semibold shrink-0">Row #{out.row_index + 1}</span>
                        <span className="truncate font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">{out.column} = "{out.value}"</span>
                        <span className="text-neutral-500 truncate text-[11px]">- {out.reason}</span>
                      </label>
                      <span className="text-[10px] font-semibold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded ml-2 shrink-0">
                        Needs Review
                      </span>
                    </div>
                  );
                })}
              </div>

              {selectedOutliersToRemove.length > 0 && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleCleanData(selectedOutliersToRemove)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Removal of Selected Outliers ({selectedOutliersToRemove.length})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Before / After Preview Table */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-2xs space-y-0">
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100/80 border-b border-neutral-200">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
            <Table className="w-4 h-4 text-io-blue" />
            <span>Dataset Preview (First 15 Rows)</span>
          </div>

          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-neutral-200 shadow-2xs text-xs">
            <button
              onClick={() => setActivePreviewTab('side-by-side')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                activePreviewTab === 'side-by-side' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setActivePreviewTab('raw')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                activePreviewTab === 'raw' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Raw Uploaded
            </button>
            {cleaningReport && (
              <button
                onClick={() => setActivePreviewTab('cleaned')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  activePreviewTab === 'cleaned' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Cleaned Result
              </button>
            )}
          </div>
        </div>

        <div className="p-3">
          {activePreviewTab === 'side-by-side' && cleaningReport ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* RAW TABLE */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>RAW Uploaded CSV (Before)</span>
                </div>
                <PreviewTable data={rawPreview} columns={rawColumns} highlightNulls />
              </div>

              {/* CLEANED TABLE */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>AI Cleaned CSV (After)</span>
                </div>
                <PreviewTable data={cleanedPreview.length > 0 ? cleanedPreview : rawPreview} columns={cleanedColumns} isCleaned />
              </div>
            </div>
          ) : activePreviewTab === 'raw' || !cleaningReport ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-400" />
                <span>RAW Uploaded CSV (First 15 Rows)</span>
              </div>
              <PreviewTable data={rawPreview} columns={rawColumns} highlightNulls />
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>AI Cleaned CSV (First 15 Rows)</span>
              </div>
              <PreviewTable data={cleanedPreview} columns={cleanedColumns} isCleaned />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component for rendering dataset rows
const PreviewTable: React.FC<{
  data: Record<string, any>[];
  columns: string[];
  highlightNulls?: boolean;
  isCleaned?: boolean;
}> = ({ data, columns, highlightNulls = false, isCleaned = false }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-neutral-400 bg-neutral-50 rounded-lg border border-neutral-200">
        No dataset rows to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 max-h-72">
      <table className="w-full text-left border-collapse text-[11px]">
        <thead className="bg-neutral-100 text-neutral-800 font-semibold sticky top-0 z-10 border-b border-neutral-200">
          <tr>
            <th className="p-2 w-10 text-center font-mono text-neutral-400 bg-neutral-100">#</th>
            {columns.map((col) => (
              <th key={col} className="p-2 font-mono whitespace-nowrap border-l border-neutral-200/60">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-neutral-50/80 transition">
              <td className="p-2 text-center font-mono text-[10px] text-neutral-400 bg-neutral-50/50 select-none">
                {idx + 1}
              </td>
              {columns.map((col) => {
                const val = row[col];
                const isBlank = val === null || val === undefined || String(val).trim() === '';

                return (
                  <td
                    key={col}
                    className={`p-2 font-mono whitespace-nowrap border-l border-neutral-100 max-w-[180px] truncate ${
                      isBlank && highlightNulls
                        ? 'bg-amber-100/70 text-amber-900 font-bold italic'
                        : isCleaned
                        ? 'text-neutral-900'
                        : 'text-neutral-700'
                    }`}
                  >
                    {isBlank ? (
                      <span className="text-amber-800 text-[10px] font-sans italic opacity-80">(null)</span>
                    ) : (
                      String(val)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
