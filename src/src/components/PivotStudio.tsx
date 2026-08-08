import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Filter,
  ArrowUpDown,
  Download,
  Search,
  RefreshCw,
  Layers,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Database,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const SAMPLE_PIVOT_DATASETS = [
  {
    name: 'Sales & Revenue Log',
    filename: 'sample_sales_data.csv',
    columns: ['Region', 'Category', 'Sales Rep', 'Quarter', 'Revenue', 'Units Sold', 'Profit Margin'],
    rows: [
      { Region: 'North America', Category: 'Electronics', 'Sales Rep': 'Sarah Chen', Quarter: 'Q1', Revenue: 45000, 'Units Sold': 120, 'Profit Margin': 0.28 },
      { Region: 'North America', Category: 'Furniture', 'Sales Rep': 'Sarah Chen', Quarter: 'Q1', Revenue: 28000, 'Units Sold': 45, 'Profit Margin': 0.18 },
      { Region: 'North America', Category: 'Electronics', 'Sales Rep': 'John Davis', Quarter: 'Q2', Revenue: 52000, 'Units Sold': 140, 'Profit Margin': 0.31 },
      { Region: 'North America', Category: 'Software', 'Sales Rep': 'John Davis', Quarter: 'Q2', Revenue: 95000, 'Units Sold': 340, 'Profit Margin': 0.68 },
      { Region: 'Europe', Category: 'Electronics', 'Sales Rep': 'Emma Wilson', Quarter: 'Q1', Revenue: 38000, 'Units Sold': 95, 'Profit Margin': 0.25 },
      { Region: 'Europe', Category: 'Furniture', 'Sales Rep': 'Emma Wilson', Quarter: 'Q2', Revenue: 31000, 'Units Sold': 50, 'Profit Margin': 0.22 },
      { Region: 'Europe', Category: 'Software', 'Sales Rep': 'Lars Mueller', Quarter: 'Q1', Revenue: 64000, 'Units Sold': 210, 'Profit Margin': 0.65 },
      { Region: 'Europe', Category: 'Software', 'Sales Rep': 'Lars Mueller', Quarter: 'Q2', Revenue: 78000, 'Units Sold': 260, 'Profit Margin': 0.62 },
      { Region: 'Asia-Pacific', Category: 'Electronics', 'Sales Rep': 'Kenji Sato', Quarter: 'Q1', Revenue: 71000, 'Units Sold': 180, 'Profit Margin': 0.34 },
      { Region: 'Asia-Pacific', Category: 'Software', 'Sales Rep': 'Kenji Sato', Quarter: 'Q2', Revenue: 89000, 'Units Sold': 310, 'Profit Margin': 0.70 },
      { Region: 'Asia-Pacific', Category: 'Furniture', 'Sales Rep': 'Mei Lin', Quarter: 'Q1', Revenue: 19000, 'Units Sold': 30, 'Profit Margin': 0.15 },
      { Region: 'Latin America', Category: 'Electronics', 'Sales Rep': 'Carlos Gomez', Quarter: 'Q1', Revenue: 29000, 'Units Sold': 75, 'Profit Margin': 0.24 },
      { Region: 'Latin America', Category: 'Furniture', 'Sales Rep': 'Carlos Gomez', Quarter: 'Q2', Revenue: 16000, 'Units Sold': 28, 'Profit Margin': 0.16 },
    ],
  },
  {
    name: 'HR & Payroll Analytics',
    filename: 'sample_hr_analytics.csv',
    columns: ['Department', 'Location', 'Employment Status', 'Base Salary', 'Bonus', 'Years Experience'],
    rows: [
      { Department: 'Engineering', Location: 'San Francisco', 'Employment Status': 'Full-Time', 'Base Salary': 145000, Bonus: 22000, 'Years Experience': 6 },
      { Department: 'Engineering', Location: 'New York', 'Employment Status': 'Full-Time', 'Base Salary': 138000, Bonus: 18000, 'Years Experience': 5 },
      { Department: 'Engineering', Location: 'Remote', 'Employment Status': 'Contractor', 'Base Salary': 110000, Bonus: 0, 'Years Experience': 4 },
      { Department: 'Marketing', Location: 'San Francisco', 'Employment Status': 'Full-Time', 'Base Salary': 98000, Bonus: 12000, 'Years Experience': 4 },
      { Department: 'Marketing', Location: 'New York', 'Employment Status': 'Full-Time', 'Base Salary': 105000, Bonus: 15000, 'Years Experience': 5 },
      { Department: 'Sales', Location: 'Chicago', 'Employment Status': 'Full-Time', 'Base Salary': 85000, Bonus: 45000, 'Years Experience': 7 },
      { Department: 'Sales', Location: 'San Francisco', 'Employment Status': 'Full-Time', 'Base Salary': 92000, Bonus: 55000, 'Years Experience': 8 },
      { Department: 'Operations', Location: 'Chicago', 'Employment Status': 'Full-Time', 'Base Salary': 78000, Bonus: 8000, 'Years Experience': 3 },
      { Department: 'Operations', Location: 'Remote', 'Employment Status': 'Contractor', 'Base Salary': 65000, Bonus: 0, 'Years Experience': 2 },
    ],
  },
];

interface PivotStudioProps {
  data?: Record<string, any>[];
  columns?: string[];
  filename?: string;
  theme?: string;
  onSendPivotToAnalyst?: (csvText: string, description: string) => void;
}

export const PivotStudio: React.FC<PivotStudioProps> = ({
  data: initialData,
  columns: initialColumns,
  filename: initialFilename,
  theme = 'light',
  onSendPivotToAnalyst,
}) => {
  // Sample Dataset Switcher state
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const [useSampleData, setUseSampleData] = useState<boolean>(() => !initialData || initialData.length === 0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const hasUserUploadedData = useMemo(() => {
    return Boolean(initialData && initialData.length > 0);
  }, [initialData]);

  const activeData = useMemo(() => {
    if (!useSampleData && initialData && initialData.length > 0) {
      return initialData;
    }
    return SAMPLE_PIVOT_DATASETS[selectedSampleIndex]?.rows || [];
  }, [useSampleData, initialData, selectedSampleIndex]);

  const activeColumns = useMemo(() => {
    if (!useSampleData && initialColumns && initialColumns.length > 0) {
      return initialColumns;
    }
    if (!useSampleData && initialData && initialData[0]) {
      return Object.keys(initialData[0]);
    }
    return SAMPLE_PIVOT_DATASETS[selectedSampleIndex]?.columns || [];
  }, [useSampleData, initialColumns, initialData, selectedSampleIndex]);

  const activeFilename = useMemo(() => {
    if (!useSampleData && initialFilename) {
      return initialFilename;
    }
    return SAMPLE_PIVOT_DATASETS[selectedSampleIndex]?.filename || 'sample_dataset.csv';
  }, [useSampleData, initialFilename, selectedSampleIndex]);

  // Grid State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Pivot Engine State
  const [rowField, setRowField] = useState<string>('');
  const [colField, setColField] = useState<string>('None');
  const [valField, setValField] = useState<string>('');
  const [aggFunc, setAggFunc] = useState<'sum' | 'avg' | 'count' | 'min' | 'max'>('sum');

  // Full state re-initialization when dataset props or sample dataset switch change
  useEffect(() => {
    setIsCalculating(true);

    if (initialData && initialData.length > 0) {
      setUseSampleData(false);
    }

    // Reset grid filters, pagination, search query
    setSearchQuery('');
    setSortColumn(null);
    setSortDirection('asc');
    setCurrentPage(1);

    // Identify active columns for the newly supplied/selected dataset
    const currentCols =
      !useSampleData && initialColumns && initialColumns.length > 0
        ? initialColumns
        : !useSampleData && initialData && initialData[0]
        ? Object.keys(initialData[0])
        : SAMPLE_PIVOT_DATASETS[selectedSampleIndex]?.columns || [];

    const currentRows =
      !useSampleData && initialData && initialData.length > 0
        ? initialData
        : SAMPLE_PIVOT_DATASETS[selectedSampleIndex]?.rows || [];

    if (currentCols.length > 0) {
      setRowField(currentCols[0]);
      setColField('None');

      const isNumericVal = (val: any) => {
        if (val === null || val === undefined || val === '') return false;
        if (typeof val === 'number') return !isNaN(val);
        const str = String(val).replace(/[^0-9.-]+/g, '');
        return str.length > 0 && !isNaN(Number(str));
      };

      const numCol =
        currentCols.find((col) => currentRows.some((row) => isNumericVal(row[col]))) ||
        currentCols[1] ||
        currentCols[0];

      setValField(numCol);
      setAggFunc('sum');
    }

    const timer = setTimeout(() => {
      setIsCalculating(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [initialData, initialColumns, initialFilename, selectedSampleIndex, useSampleData]);

  // Trigger a brief loading calculation transition when dimension controls change
  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => {
      setIsCalculating(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [rowField, colField, valField, aggFunc]);

  // Reset pagination on search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filtered & Sorted Rows for Grid View
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return activeData;
    const q = searchQuery.toLowerCase();
    return activeData.filter((row) =>
      Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(q))
    );
  }, [activeData, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Helper to safely parse numbers from raw table cells
  const parseNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(/[^0-9.-]+/g, '');
    if (!str) return 0;
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Pivot Matrix Calculation
  const pivotMatrix = useMemo(() => {
    if (!rowField || activeData.length === 0) {
      return { rowKeys: [], colKeys: [], matrix: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };
    }

    const rowKeysSet = new Set<string>();
    const colKeysSet = new Set<string>();
    const groups: Record<string, Record<string, number[]>> = {};

    activeData.forEach((item) => {
      const rKey = String(item[rowField] ?? '(Blank)');
      const cKey = colField && colField !== 'None' ? String(item[colField] ?? '(Blank)') : 'Value';

      rowKeysSet.add(rKey);
      colKeysSet.add(cKey);

      if (!groups[rKey]) groups[rKey] = {};
      if (!groups[rKey][cKey]) groups[rKey][cKey] = [];

      const numVal = parseNum(item[valField]);
      groups[rKey][cKey].push(numVal);
    });

    const rowKeys = Array.from(rowKeysSet).sort();
    const colKeys = Array.from(colKeysSet).sort();

    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let allValues: number[] = [];

    const computeAgg = (nums: number[]) => {
      if (!nums || nums.length === 0) return 0;
      if (aggFunc === 'sum') return nums.reduce((a, b) => a + b, 0);
      if (aggFunc === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
      if (aggFunc === 'count') return nums.length;
      if (aggFunc === 'min') return Math.min(...nums);
      if (aggFunc === 'max') return Math.max(...nums);
      return 0;
    };

    rowKeys.forEach((rKey) => {
      matrix[rKey] = {};
      let rowNums: number[] = [];
      colKeys.forEach((cKey) => {
        const nums = groups[rKey]?.[cKey] || [];
        const val = computeAgg(nums);
        matrix[rKey][cKey] = val;
        rowNums.push(...nums);

        allValues.push(...nums);
      });
      rowTotals[rKey] = computeAgg(rowNums);
    });

    colKeys.forEach((cKey) => {
      let colNums: number[] = [];
      rowKeys.forEach((rKey) => {
        const nums = groups[rKey]?.[cKey] || [];
        colNums.push(...nums);
      });
      colTotals[cKey] = computeAgg(colNums);
    });

    const grandTotal = computeAgg(allValues);

    return { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal };
  }, [activeData, rowField, colField, valField, aggFunc]);

  const exportPivotCsv = () => {
    const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal } = pivotMatrix;
    const headerRow = [rowField, ...colKeys, 'Total'];
    const rows = rowKeys.map((rKey) => [
      rKey,
      ...colKeys.map((cKey) => matrix[rKey][cKey]?.toFixed(2) || '0'),
      rowTotals[rKey]?.toFixed(2) || '0',
    ]);
    const footerRow = ['Total', ...colKeys.map((cKey) => colTotals[cKey]?.toFixed(2) || '0'), grandTotal.toFixed(2)];

    const wsData = [headerRow, ...rows, footerRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
    XLSX.writeFile(wb, `${activeFilename}_pivot.xlsx`);
  };

  const sendToAnalyst = () => {
    if (!onSendPivotToAnalyst) return;
    const { rowKeys, colKeys, matrix, rowTotals } = pivotMatrix;
    const header = [rowField, ...colKeys, 'Total'].join(',');
    const rowsText = rowKeys.map((rKey) =>
      [rKey, ...colKeys.map((cKey) => matrix[rKey][cKey]?.toFixed(2) || '0'), rowTotals[rKey]?.toFixed(2) || '0'].join(',')
    );
    const csvContent = [header, ...rowsText].join('\n');
    const promptDescription = `Analyze this aggregated Pivot Matrix for dataset "${activeFilename}". Grouped by Row: "${rowField}", Column: "${colField}", Metric: "${valField}" (${aggFunc.toUpperCase()}). Identify key trends, anomalies, and driver insights.`;

    onSendPivotToAnalyst(csvContent, promptDescription);
  };

  return (
    <div className={`space-y-6 app-theme-${theme}`}>
      {/* Top Source Switcher & Mode Indicator */}
      <div className="rounded-2xl border border-[#1E293B]/15 bg-[#F8F9FC] p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors relative overflow-hidden bg-[linear-gradient(#00000008_1px,transparent_1px)] [background-size:100%_28px]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#1E293B] text-[#F8F9FC] shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1E293B] flex items-center gap-2">
              <span>{useSampleData ? 'Interactive Sample Data Mode' : 'Custom Dataset Active'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E293B]/10 text-[#1E293B]">
                {activeFilename}
              </span>
            </p>
            <p className="text-xs text-[#64748B] mt-0.5">
              {useSampleData
                ? 'Showing built-in sample dataset. Upload a CSV in the Analyst tab anytime to pivot custom data.'
                : `Currently pivoting ${activeData.length.toLocaleString()} rows from your uploaded dataset.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap font-mono">
          {hasUserUploadedData && (
            <button
              onClick={() => setUseSampleData(!useSampleData)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                !useSampleData
                  ? 'bg-[#1E293B] text-[#F8F9FC] shadow-2xs'
                  : 'bg-[#F3F5F8] text-[#1E293B] hover:bg-[#1E293B]/10 border border-[#1E293B]/20'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Use My Upload ({initialFilename || 'CSV'})</span>
            </button>
          )}

          {useSampleData &&
            SAMPLE_PIVOT_DATASETS.map((ds, idx) => (
              <button
                key={ds.name}
                onClick={() => {
                  setSelectedSampleIndex(idx);
                  setUseSampleData(true);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                  selectedSampleIndex === idx && useSampleData
                    ? 'bg-[#1E293B] text-[#F8F9FC] shadow-2xs'
                    : 'bg-[#F3F5F8] text-[#1E293B] hover:bg-[#1E293B]/10 border border-[#1E293B]/20'
                }`}
              >
                {ds.name}
              </button>
            ))}
        </div>
      </div>

      {/* Pivot Studio Setup Card */}
      <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
        {isCalculating && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] flex flex-col items-center justify-center z-30 transition-all duration-200">
            <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl animate-spin mb-3 shadow-2xs border border-purple-100">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-neutral-900 dark:text-slate-100 tracking-tight">
              Calculating Pivot Matrix & Indexing Grid...
            </p>
            <p className="text-xs text-neutral-500 dark:text-slate-400 font-mono mt-1">
              {activeData.length.toLocaleString()} records • {activeColumns.length} dimensions
            </p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                Interactive Pivot Table Studio
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                  Theme: {theme}
                </span>
              </h2>
              <p className="text-xs text-neutral-500">
                Aggregate, pivot, and slice dataset columns dynamically without complex formulas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onSendPivotToAnalyst && (
              <button
                onClick={sendToAnalyst}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Matrix with AI
              </button>
            )}

            <button
              onClick={exportPivotCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export Pivot (.xlsx)
            </button>
          </div>
        </div>

        {/* Pivot Controls Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Row Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" /> Row Dimension
            </label>
            <select
              value={rowField}
              onChange={(e) => setRowField(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {activeColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Column Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" /> Column Dimension
            </label>
            <select
              value={colField}
              onChange={(e) => setColField(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="None">(None - Single Column)</option>
              {activeColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Value Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Metric Field
            </label>
            <select
              value={valField}
              onChange={(e) => setValField(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {activeColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Aggregation Function */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              Aggregation
            </label>
            <select
              value={aggFunc}
              onChange={(e) => setAggFunc(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="sum">SUM (Total)</option>
              <option value="avg">AVERAGE (Mean)</option>
              <option value="count">COUNT (Rows)</option>
              <option value="min">MINIMUM</option>
              <option value="max">MAXIMUM</option>
            </select>
          </div>
        </div>

        {/* Pivot Matrix Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-neutral-100 text-neutral-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 border-b border-r border-neutral-200">
                  {rowField || 'Row Label'}
                </th>
                {pivotMatrix.colKeys.map((cKey) => (
                  <th key={cKey} className="p-3 border-b border-r border-neutral-200 text-right">
                    {cKey}
                  </th>
                ))}
                <th className="p-3 border-b border-neutral-200 text-right bg-purple-100 text-purple-900 font-bold">
                  Total ({aggFunc.toUpperCase()})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {pivotMatrix.rowKeys.length === 0 ? (
                <tr>
                  <td colSpan={pivotMatrix.colKeys.length + 2} className="p-8 text-center text-neutral-400">
                    No pivot matrix data available. Select valid row & value columns.
                  </td>
                </tr>
              ) : (
                pivotMatrix.rowKeys.map((rKey) => (
                  <tr key={rKey} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-3 font-semibold border-r border-neutral-200 text-neutral-900">
                      {rKey}
                    </td>
                    {pivotMatrix.colKeys.map((cKey) => {
                      const val = pivotMatrix.matrix[rKey]?.[cKey] ?? 0;
                      return (
                        <td key={cKey} className="p-3 text-right font-mono border-r border-neutral-200 text-neutral-700">
                          {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-mono font-bold bg-purple-50/60 text-purple-900">
                      {pivotMatrix.rowTotals[rKey]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {pivotMatrix.rowKeys.length > 0 && (
              <tfoot className="bg-neutral-100 font-bold border-t-2 border-neutral-300">
                <tr>
                  <td className="p-3 border-r border-neutral-200 text-neutral-900 uppercase">
                    Grand Total
                  </td>
                  {pivotMatrix.colKeys.map((cKey) => (
                    <td key={cKey} className="p-3 text-right font-mono border-r border-neutral-200 text-neutral-900">
                      {pivotMatrix.colTotals[cKey]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="p-3 text-right font-mono bg-purple-200 text-purple-950 font-black">
                    {pivotMatrix.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Dynamic Browser Grid & Row Filter */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search across all table rows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-neutral-500 whitespace-nowrap">
              {filteredRows.length.toLocaleString()} rows
            </span>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2 text-xs">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-100 cursor-pointer text-neutral-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-neutral-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-100 cursor-pointer text-neutral-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Grid Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200 max-h-96">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-neutral-100 text-neutral-700 font-bold uppercase tracking-wider z-10">
              <tr>
                <th className="p-3 w-12 text-center border-b border-neutral-200">#</th>
                {activeColumns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="p-3 border-b border-neutral-200 cursor-pointer hover:bg-neutral-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col}</span>
                      <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="p-8 text-center text-neutral-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-3 text-center text-neutral-400 font-mono">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    {activeColumns.map((col) => (
                      <td key={col} className="p-3 text-neutral-800">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
