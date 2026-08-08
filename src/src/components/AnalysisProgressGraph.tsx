import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Database, BarChart3, PieChart, FileText, CheckCircle2 } from 'lucide-react';

interface AnalysisProgressGraphProps {
  stage: string;
  datasetName?: string;
}

const STAGES = [
  { id: 'ingest', label: 'Dataset Ingestion & Validation', icon: Database },
  { id: 'profile', label: 'Schema Profiling & Type Detection', icon: BarChart3 },
  { id: 'analyze', label: 'Statistical & Trend Calculations', icon: PieChart },
  { id: 'render', label: 'Chart & Visual Generation', icon: BarChart3 },
  { id: 'report', label: 'Executive Report Synthesis', icon: FileText },
];

export const AnalysisProgressGraph: React.FC<AnalysisProgressGraphProps> = ({ stage, datasetName }) => {
  const [progress, setProgress] = useState<number>(15);
  const [activeBars, setActiveBars] = useState<number[]>([40, 65, 30, 85, 55, 70, 90, 45]);

  // Determine stage index
  const getCurrentStageIndex = (): number => {
    const s = stage?.toLowerCase() || '';
    if (s.includes('load') || s.includes('ingest')) return 0;
    if (s.includes('profile')) return 1;
    if (s.includes('analyz') || s.includes('model') || s.includes('group')) return 2;
    if (s.includes('chart') || s.includes('render')) return 3;
    if (s.includes('report') || s.includes('compil')) return 4;
    return 2; // Default to step 3
  };

  const currentStep = getCurrentStageIndex();

  // Progress animation tick
  useEffect(() => {
    const targetProgress = Math.min(95, (currentStep + 1) * 20);
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev < targetProgress) return prev + 1;
        return prev;
      });

      // Animate bar heights dynamically to show real-time analysis calculation
      setActiveBars((prev) =>
        prev.map((val) => {
          const delta = (Math.random() - 0.48) * 15;
          return Math.min(100, Math.max(15, Math.round(val + delta)));
        })
      );
    }, 300);

    return () => clearInterval(timer);
  }, [currentStep]);

  const barColors = [
    '#1E293B',
    '#6366F1',
    '#334155',
    '#94A3B8',
    '#64748B',
    '#1E293B',
    '#6366F1',
    '#334155',
  ];

  return (
    <div className="w-full glass-ledger-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[520px] relative overflow-hidden bg-[linear-gradient(#00000008_1px,transparent_1px)] [background-size:100%_28px]">
      <div className="absolute top-0 bottom-0 left-6 w-[1px] bg-[#6366F1]/30 pointer-events-none" />

      {/* Header Info */}
      <div className="pl-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B]/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-[#F8F9FC] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#1E293B]">Autonomous AI Analysis in Progress</h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-[#1E293B]/10 text-[#1E293B]">
                {progress}% Complete
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Analyzing {datasetName || 'dataset'} with statistical models & auto-visualizations...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
          <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-ping" />
          <span className="text-xs font-semibold text-[#1E293B]">
            {stage || 'Processing data...'}
          </span>
        </div>
      </div>

      {/* DYNAMIC ANIMATED BAR GRAPH */}
      <div className="ml-3 my-6 p-6 rounded-xl bg-[#F3F5F8] border border-[#1E293B]/15 relative overflow-hidden">
        <div className="flex justify-between items-baseline mb-4 font-mono">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
              Live Data Computation Stream
            </span>
            <p className="text-xs sm:text-sm font-semibold text-[#1E293B] mt-0.5">
              Real-time Feature Distribution & Correlation Processing
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[#1E293B] bg-[#1E293B]/10 px-2.5 py-1 rounded-lg">
            ~{(progress * 14.2).toFixed(0)} rows/sec
          </span>
        </div>

        {/* Bar Graph Grid Container */}
        <div className="h-48 w-full flex items-end justify-between gap-2 sm:gap-4 pt-4 border-b border-[#1E293B]/20 relative">
          {/* Horizontal grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-dashed border-[#1E293B] w-full" />
            <div className="border-b border-dashed border-[#1E293B] w-full" />
            <div className="border-b border-dashed border-[#1E293B] w-full" />
          </div>

          {activeBars.map((height, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end z-10">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full rounded-t-xl relative group cursor-pointer"
                style={{ backgroundColor: barColors[i % barColors.length] }}
              >
                {/* Soft top gradient */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/40 rounded-t-xl" />
                {/* Value Badge on Hover / Active */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm">
                  {height}%
                </div>
              </motion.div>
              <span className="text-[10px] font-mono font-semibold text-slate-400">
                F{i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Steps Indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-2">
        {STAGES.map((stg, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div
              key={stg.id}
              className={`p-3 rounded-xl border transition-all flex flex-col items-start gap-1.5 ${
                isCurrent
                  ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-2xs'
                  : isDone
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-white border-slate-100 text-slate-400 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <stg.icon className={`w-4 h-4 ${isCurrent ? 'text-indigo-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`} />
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                ) : null}
              </div>
              <span className="text-[11px] font-bold leading-tight">
                {stg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
