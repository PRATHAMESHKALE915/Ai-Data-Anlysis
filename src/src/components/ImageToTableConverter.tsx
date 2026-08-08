import React, { useState, useRef, useEffect } from 'react';
import {
  ImageUp,
  Sparkles,
  FileSpreadsheet,
  FileText,
  X,
  RefreshCw,
  AlertTriangle,
  Download,
  RotateCcw,
  CheckCircle2,
  FolderTree,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

export interface ExtractedTable {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  sort_applied: string | null;
}

export interface ExtractionResult {
  tables: ExtractedTable[];
  extraction_confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'queued' | 'extracting' | 'complete' | 'error';
  result?: ExtractionResult;
  error?: string;
}

export type OutputFormat = 'excel' | 'word';

export const ImageToTableConverter: React.FC = () => {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [userInstruction, setUserInstruction] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('excel');

  const [isExtractingBatch, setIsExtractingBatch] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      batchItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const handleSelectFiles = (filesList: FileList | File[]) => {
    const newItems: BatchItem[] = [];
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB

    Array.from(filesList).forEach((file) => {
      if (file.size > MAX_SIZE) return;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      newItems.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        file,
        previewUrl,
        status: 'queued',
      });
    });

    if (newItems.length > 0) {
      setBatchItems((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemoveItem = (id: string) => {
    setBatchItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleExtractSingle = async (item: BatchItem): Promise<ExtractionResult> => {
    const formData = new FormData();
    formData.append('file', item.file);
    if (userInstruction.trim()) {
      formData.append('instruction', userInstruction.trim());
    }
    formData.append('format', 'json');

    const res = await fetch('/api/extract-image-table', {
      method: 'POST',
      body: formData,
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {}

    if (!res.ok || !data?.success || !data?.extraction) {
      throw new Error(data?.error || `Extraction failed (${res.status})`);
    }

    return data.extraction as ExtractionResult;
  };

  const handleExtractBatch = async () => {
    if (batchItems.length === 0) return;

    setIsExtractingBatch(true);

    const updated = [...batchItems];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'complete') continue;

      updated[i] = { ...updated[i], status: 'extracting', error: undefined };
      setBatchItems([...updated]);

      try {
        const result = await handleExtractSingle(updated[i]);
        updated[i] = { ...updated[i], status: 'complete', result };
      } catch (err: any) {
        updated[i] = {
          ...updated[i],
          status: 'error',
          error: err?.message || 'Failed to extract table data.',
        };
      }
      setBatchItems([...updated]);
    }

    setIsExtractingBatch(false);
  };

  // Generate Consolidated Multi-Sheet Excel Workbook (.xlsx)
  const downloadConsolidatedWorkbook = () => {
    const wb = XLSX.utils.book_new();
    let sheetCount = 0;

    batchItems.forEach((item, itemIdx) => {
      if (item.status === 'complete' && item.result?.tables) {
        item.result.tables.forEach((table, tIdx) => {
          sheetCount++;
          const sheetName =
            table.title?.slice(0, 25).replace(/[:\\\/?*\[\]]/g, '') ||
            `Table_${itemIdx + 1}_${tIdx + 1}`;

          const sheetData = [table.columns, ...table.rows];
          const ws = XLSX.utils.aoa_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
      }
    });

    if (sheetCount === 0) return;
    XLSX.writeFile(wb, `Consolidated_Tables_${Date.now()}.xlsx`);
  };

  const activeItem = batchItems[activeItemIndex] || batchItems[0];
  const completedCount = batchItems.filter((i) => i.status === 'complete').length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden text-slate-800 space-y-0">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50/70 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shrink-0">
            <ImageUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Batch Image & Document Table Extractor
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono uppercase font-bold">
                Parallel AI Engine
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload multiple screenshots or PDFs to extract tables & merge into a consolidated Excel workbook.
            </p>
          </div>
        </div>

        {completedCount > 0 && (
          <button
            onClick={downloadConsolidatedWorkbook}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FolderTree className="w-4 h-4" />
            <span>Consolidated Workbook (.xlsx)</span>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* DROPZONE */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) {
              handleSelectFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50/60 shadow-md scale-[0.99]'
              : 'border-slate-300 bg-slate-50/40 hover:border-indigo-500 hover:bg-indigo-50/20'
          }`}
        >
          <div className="p-3 bg-white rounded-full border border-slate-200 shadow-2xs text-indigo-600">
            <ImageUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Drag & Drop Multiple Files (Images or PDFs) Here
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select multiple files at once. Supports PNG, JPG, WebP screenshots, receipts, or table pages (&le; 15MB each).
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleSelectFiles(e.target.files);
            }}
          />
        </div>

        {/* BATCH QUEUE CAROUSEL / LIST */}
        {batchItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Files Queue ({batchItems.length})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  {completedCount} / {batchItems.length} Processed
                </span>
                <button
                  onClick={handleExtractBatch}
                  disabled={isExtractingBatch}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExtractingBatch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Extracting Batch AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Extract All Tables</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* File List Chips */}
            <div className="flex flex-wrap gap-2">
              {batchItems.map((item, idx) => {
                const isActive = activeItemIndex === idx;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveItemIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50'
                    }`}
                  >
                    {item.status === 'extracting' && <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                    {item.status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {item.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    {item.status === 'queued' && <div className="w-2 h-2 rounded-full bg-neutral-400" />}
                    <span className="truncate max-w-[140px]">{item.file.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      className="text-neutral-400 hover:text-red-500 p-0.5 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Item Result Preview */}
            {activeItem && activeItem.result && (
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/20 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-3">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    Preview: {activeItem.file.name} ({activeItem.result.tables.length} tables found)
                  </h4>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                    Confidence: {activeItem.result.extraction_confidence}
                  </span>
                </div>

                <div className="space-y-4">
                  {activeItem.result.tables.map((tbl, tIdx) => (
                    <div key={tIdx} className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-900">
                      <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {tbl.title || `Table ${tIdx + 1}`}
                      </div>
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="bg-neutral-50 dark:bg-neutral-800/60 font-semibold border-b border-neutral-200 dark:border-neutral-700">
                            <tr>
                              {tbl.columns.map((c, cIdx) => (
                                <th key={cIdx} className="p-2 border-r border-neutral-200 dark:border-neutral-700 font-mono">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {tbl.rows.map((r, rIdx) => (
                              <tr key={rIdx}>
                                {r.map((cell, cIdx) => (
                                  <td key={cIdx} className="p-2 font-mono border-r border-neutral-100 dark:border-neutral-800">
                                    {String(cell ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
