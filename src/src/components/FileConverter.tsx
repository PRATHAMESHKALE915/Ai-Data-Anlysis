import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileSpreadsheet,
  FileText,
  FileCode,
  Image,
  Presentation,
  Upload,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ImageUp,
} from 'lucide-react';
import { ImageToTableConverter } from './ImageToTableConverter';

export type ConversionType =
  | 'pdf-to-excel'
  | 'excel-to-pdf'
  | 'ppt-to-pdf'
  | 'pdf-to-image'
  | 'image-to-pdf'
  | 'image-to-excel'
  | 'image-to-word'
  | 'word-to-pdf';

interface ConversionTool {
  id: ConversionType;
  title: string;
  description: string;
  fromExt: string;
  toExt: string;
  accept: string;
  icon: React.ReactNode;
  gradient: string;
  badge: string;
}

const TOOLS: ConversionTool[] = [
  {
    id: 'pdf-to-excel',
    title: 'PDF to Excel',
    description: 'Extract tables & structured text from PDF into editable XLSX sheets.',
    fromExt: 'PDF',
    toExt: 'XLSX',
    accept: '.pdf,application/pdf',
    icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
    gradient: 'from-emerald-500/10 to-teal-500/10 border-emerald-200/60',
    badge: 'XLSX',
  },
  {
    id: 'image-to-excel',
    title: 'Image to Excel',
    description: 'Extract tables, receipts, or lists from photos directly into clean XLSX sheets.',
    fromExt: 'IMG',
    toExt: 'XLSX',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg',
    icon: <FileSpreadsheet className="w-5 h-5 text-teal-600" />,
    gradient: 'from-teal-500/10 to-emerald-500/10 border-teal-200/60',
    badge: 'XLSX',
  },
  {
    id: 'image-to-word',
    title: 'Image to Word',
    description: 'Extract tables or handwritten documents from images into formatted DOCX files.',
    fromExt: 'IMG',
    toExt: 'DOCX',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg',
    icon: <FileCode className="w-5 h-5 text-cyan-600" />,
    gradient: 'from-cyan-500/10 to-blue-500/10 border-cyan-200/60',
    badge: 'DOCX',
  },
  {
    id: 'excel-to-pdf',
    title: 'Excel to PDF',
    description: 'Convert XLSX/XLS workbooks into clean printable PDF documents.',
    fromExt: 'XLSX',
    toExt: 'PDF',
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    icon: <FileText className="w-5 h-5 text-red-600" />,
    gradient: 'from-red-500/10 to-rose-500/10 border-red-200/60',
    badge: 'PDF',
  },
  {
    id: 'ppt-to-pdf',
    title: 'PPT to PDF',
    description: 'Convert PowerPoint presentations (.pptx) into standard PDF slides.',
    fromExt: 'PPTX',
    toExt: 'PDF',
    accept: '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    icon: <Presentation className="w-5 h-5 text-amber-600" />,
    gradient: 'from-amber-500/10 to-orange-500/10 border-amber-200/60',
    badge: 'PDF',
  },
  {
    id: 'pdf-to-image',
    title: 'PDF to Image',
    description: 'Render PDF document pages into high-resolution formatted image previews.',
    fromExt: 'PDF',
    toExt: 'PNG/PDF',
    accept: '.pdf,application/pdf',
    icon: <Image className="w-5 h-5 text-indigo-600" />,
    gradient: 'from-indigo-500/10 to-blue-500/10 border-indigo-200/60',
    badge: 'IMAGE',
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Bundle PNG, JPEG, or WEBP images into a single formatted PDF document.',
    fromExt: 'IMG',
    toExt: 'PDF',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg',
    icon: <Image className="w-5 h-5 text-purple-600" />,
    gradient: 'from-purple-500/10 to-pink-500/10 border-purple-200/60',
    badge: 'PDF',
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert DOCX text & formatted documents directly into PDF format.',
    fromExt: 'DOCX',
    toExt: 'PDF',
    accept: '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    icon: <FileCode className="w-5 h-5 text-blue-600" />,
    gradient: 'from-blue-500/10 to-cyan-500/10 border-blue-200/60',
    badge: 'PDF',
  },
];

export const FileConverter: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<ConversionType>('pdf-to-excel');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [userInstruction, setUserInstruction] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string | null>(null);

  const activeTool = TOOLS.find((t) => t.id === selectedTool) || TOOLS[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setError(null);
      setDownloadUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setError(null);
      setDownloadUrl(null);
    }
  };

  const executeConversion = async () => {
    if (selectedFiles.length === 0) return;
    setIsConverting(true);
    setError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('file', file));
      formData.append('type', selectedTool);
      if (userInstruction.trim()) {
        formData.append('instruction', userInstruction.trim());
      }

      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Conversion failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `converted.${activeTool.toExt.toLowerCase()}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(filename);

      // Trigger auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during file conversion.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Tool Selector Grid */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          Select Document Converter
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {TOOLS.map((tool) => {
            const isSelected = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => {
                  setSelectedTool(tool.id);
                  setSelectedFiles([]);
                  setError(null);
                  setDownloadUrl(null);
                }}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-md scale-[1.02]'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <div className="p-2 rounded-lg bg-neutral-100/80 mb-2">
                  {tool.icon}
                </div>
                <span className="text-xs font-semibold leading-tight">{tool.title}</span>
                <div className="mt-1 flex items-center gap-1 text-[10px] opacity-75">
                  <span>{tool.fromExt}</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                  <span>{tool.toExt}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Converter Panel */}
      {selectedTool === 'image-to-excel' || selectedTool === 'image-to-word' ? (
        <motion.div
          key={selectedTool}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ImageToTableConverter />
        </motion.div>
      ) : (
        <motion.div
          key={activeTool.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5"
        >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-100 text-neutral-800">
              {activeTool.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">{activeTool.title}</h2>
              <p className="text-xs text-neutral-500">{activeTool.description}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-neutral-100 text-neutral-700">
            {activeTool.fromExt} → {activeTool.toExt}
          </span>
        </div>

        {/* File Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-xl p-8 text-center bg-neutral-50/50 hover:bg-neutral-50 transition flex flex-col items-center justify-center relative cursor-pointer"
        >
          <input
            type="file"
            accept={activeTool.accept}
            multiple={activeTool.id === 'image-to-pdf'}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="p-3 rounded-full bg-white shadow-xs border border-neutral-200 mb-3 text-neutral-600">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-neutral-800">
            Drag & drop your {activeTool.fromExt} file{activeTool.id === 'image-to-pdf' ? 's' : ''} here
          </p>
          <p className="text-xs text-neutral-500 mt-1">or click to browse local files</p>
        </div>

        {/* Selected File List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Selected File{selectedFiles.length > 1 ? 's' : ''} ({selectedFiles.length})
            </div>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-neutral-50/50 overflow-hidden">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 text-xs">
                  <span className="font-medium text-neutral-800 truncate max-w-md">{f.name}</span>
                  <span className="text-neutral-500 font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Download Success */}
        {downloadUrl && downloadName && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Conversion Complete!</p>
                <p className="text-emerald-700">{downloadName}</p>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={downloadName}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        )}

        {/* Convert Action Button */}
        <div className="flex justify-end pt-2">
          <button
            disabled={selectedFiles.length === 0 || isConverting}
            onClick={executeConversion}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Converting Document...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Convert to {activeTool.toExt}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
      )}
    </div>
  );
};
