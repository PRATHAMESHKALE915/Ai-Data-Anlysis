import React, { useState } from 'react';
import { Sparkles, Bookmark, Plus, Trash2, ArrowRight, FolderArchive, Download } from 'lucide-react';
import JSZip from 'jszip';

export interface AnalysisTemplate {
  id: string;
  title: string;
  description: string;
  promptText: string;
  category: 'finance' | 'sales' | 'operations' | 'executive' | 'custom';
}

const DEFAULT_TEMPLATES: AnalysisTemplate[] = [
  {
    id: 'financial-audit',
    title: 'Monthly Financial Health Audit',
    description: 'Analyze total revenue, gross profit margins, top expense categories, and monthly variance trends.',
    promptText: 'Perform a comprehensive financial audit on this dataset. Calculate total revenue, cost trends, profit margins, and highlight top expense anomalies or monthly growth percentage variances.',
    category: 'finance',
  },
  {
    id: 'sales-growth',
    title: 'Sales Growth & Regional Variance Analysis',
    description: 'Break down revenue by product line, region, rep performance, and growth trajectory.',
    promptText: 'Analyze sales performance across regions and product lines. Identify top-performing channels, seasonal patterns, low-performing categories, and provide 3 actionable growth recommendations.',
    category: 'sales',
  },
  {
    id: 'exec-summary',
    title: 'Executive KPI Summary Generator',
    description: 'Produce high-level metric cards, key strategic insights, and an executive briefing summary.',
    promptText: 'Summarize this dataset into an executive briefing suitable for C-level leadership. Include 4 headline KPIs with exact numbers, key operational insights, and critical risks.',
    category: 'executive',
  },
  {
    id: 'inventory-anomaly',
    title: 'Inventory & Supply Chain Anomaly Detection',
    description: 'Detect stockouts, slow-moving SKUs, supply bottlenecks, and turnover rates.',
    promptText: 'Scan this inventory/supply dataset for anomalies, stockout risks, overstocked SKUs, and unusual lead-time spikes. Create a table of critical inventory alerts.',
    category: 'operations',
  },
  {
    id: 'customer-churn',
    title: 'Customer Churn & Retention Risk Summary',
    description: 'Segment customer activity, engagement drops, and retention indicators.',
    promptText: 'Analyze customer retention and churn indicators. Segment customers by activity level, highlight accounts with declining usage/revenue, and recommend retention interventions.',
    category: 'sales',
  },
];

interface AnalysisTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string) => void;
  workspaceFiles?: any[];
  reports?: any[];
}

export const AnalysisTemplatesModal: React.FC<AnalysisTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  workspaceFiles = [],
  reports = [],
}) => {
  const [templates, setTemplates] = useState<AnalysisTemplate[]>(() => {
    const saved = localStorage.getItem('user_analysis_templates');
    if (saved) {
      try {
        return [...DEFAULT_TEMPLATES, ...JSON.parse(saved)];
      } catch {
        return DEFAULT_TEMPLATES;
      }
    }
    return DEFAULT_TEMPLATES;
  });

  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  if (!isOpen) return null;

  const handleAddTemplate = () => {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    const newT: AnalysisTemplate = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      description: 'Custom user preset routine',
      promptText: newPrompt.trim(),
      category: 'custom',
    };
    const updated = [newT, ...templates];
    setTemplates(updated);

    const customOnly = updated.filter((t) => t.category === 'custom');
    localStorage.setItem('user_analysis_templates', JSON.stringify(customOnly));

    setNewTitle('');
    setNewPrompt('');
    setShowAddForm(false);
  };

  const handleDeleteCustom = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    const customOnly = updated.filter((t) => t.category === 'custom');
    localStorage.setItem('user_analysis_templates', JSON.stringify(customOnly));
  };

  const exportWorkspaceZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();

      // Folder 1: Datasets
      const dataFolder = zip.folder('datasets');
      workspaceFiles.forEach((file) => {
        if (file.content) {
          dataFolder?.file(file.name || 'data.csv', file.content);
        }
      });

      // Folder 2: Analysis Reports JSON
      const reportFolder = zip.folder('reports');
      reports.forEach((rep, idx) => {
        reportFolder?.file(`report_${idx + 1}_${rep.dataset_name || 'analysis'}.json`, JSON.stringify(rep, null, 2));
      });

      // Summary README
      zip.file(
        'README.txt',
        `Data & Document Hub Workspace Export\nGenerated At: ${new Date().toLocaleString()}\nFiles Included: ${workspaceFiles.length}\nReports Generated: ${reports.length}`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = `Workspace_Export_${Date.now()}.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error('Failed to export ZIP:', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Saved Analysis Routines & Workspace Package
              </h2>
              <p className="text-xs text-neutral-500">
                Choose prompt routines or export complete raw datasets & reports into a ZIP archive.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Workspace ZIP Export Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-blue-950">
                  Export Workspace Package (.ZIP)
                </h3>
                <p className="text-[11px] text-blue-700">
                  Bundles all active datasets, extracted tables, reports, and charts into a single ZIP file.
                </p>
              </div>
            </div>

            <button
              onClick={exportWorkspaceZip}
              disabled={isExportingZip}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              {isExportingZip ? 'Packing ZIP...' : 'Download Workspace ZIP'}
            </button>
          </div>

          {/* Preset Routines List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Prompt Routine Presets
              </h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Custom Preset
              </button>
            </div>

            {/* Custom Template Add Form */}
            {showAddForm && (
              <div className="mb-4 p-4 rounded-xl bg-neutral-50 border border-purple-200 space-y-3">
                <input
                  type="text"
                  placeholder="Routine Title (e.g., Weekly Operations Check)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <textarea
                  placeholder="Detailed AI Prompt Instructions..."
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTemplate}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer"
                  >
                    Save Routine
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-purple-300 transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">
                        {tpl.title}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">{tpl.description}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {tpl.category === 'custom' && (
                      <button
                        onClick={() => handleDeleteCustom(tpl.id)}
                        className="p-2 text-neutral-400 hover:text-red-600 rounded-lg"
                        title="Delete custom routine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onSelectPrompt(tpl.promptText);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>Run Prompt</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
