import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  Image as ImageIcon,
  Maximize2,
  HelpCircle,
  Sparkles,
  Palette,
  Download,
  Compass,
  Layers,
} from 'lucide-react';
import type { ReportChart, ReportTable } from '../types';

export const PALETTES = {
  pastel: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316'],
  soft: ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c'],
  emerald: ['#10b981', '#34d399', '#059669', '#06b6d4', '#14b8a6', '#0d9488', '#0284c7', '#6ee7b7'],
  ocean: ['#3b82f6', '#06b6d4', '#6366f1', '#0284c7', '#38bdf8', '#818cf8', '#64748b', '#94a3b8'],
  warm: ['#f59e0b', '#fb923c', '#f43f5e', '#8b5cf6', '#d97706', '#ea580c', '#e11d48', '#a855f7'],
};

interface InteractiveChartProps {
  chart: ReportChart;
  tables?: ReportTable[];
  onZoom?: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const totalValue = payload.reduce((sum: number, entry: any) => {
      const v = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value) || 0;
      return sum + v;
    }, 0);

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs min-w-[180px] space-y-2 pointer-events-none z-50">
        <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
          <span className="font-semibold text-slate-200 truncate">{label || 'Data Point'}</span>
          <span className="text-[10px] uppercase font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
            Metric
          </span>
        </div>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => {
            const rawVal = entry.value;
            const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
            const formattedVal = typeof numVal === 'number' && !isNaN(numVal)
              ? numVal.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : String(rawVal);

            const pct = totalValue > 0 && typeof numVal === 'number'
              ? ((numVal / totalValue) * 100).toFixed(1)
              : null;

            return (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="text-slate-300 truncate font-medium">{entry.name || 'Value'}:</span>
                </div>
                <div className="text-right font-mono font-bold text-white shrink-0">
                  <span>{formattedVal}</span>
                  {pct && <span className="ml-1 text-[10px] text-slate-400 font-normal">({pct}%)</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  chart,
  tables = [],
  onZoom,
}) => {
  const [viewType, setViewType] = useState<'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter' | 'composed' | 'image'>('bar');
  const [activePalette, setActivePalette] = useState<keyof typeof PALETTES>('pastel');
  const currentPalette = PALETTES[activePalette];

  const { chartData, xKey, seriesKeys } = useMemo(() => {
    if (chart.data && chart.data.length > 0) {
      const firstRow = chart.data[0];
      const keys = Object.keys(firstRow);
      const xK = chart.xKey || keys[0] || 'category';
      const sK = chart.series || keys.filter((k) => k !== xK);
      return { chartData: chart.data, xKey: xK, seriesKeys: sK };
    }

    if (tables && tables.length > 0) {
      const matchedTable =
        tables.find((t) => t.title?.toLowerCase().includes(chart.title?.toLowerCase())) ||
        tables[0];

      if (matchedTable && matchedTable.columns.length >= 2 && matchedTable.rows.length > 0) {
        const xColumn = matchedTable.columns[0];
        const valueColumns = matchedTable.columns.slice(1);

        const dataset = matchedTable.rows.slice(0, 30).map((row) => {
          const item: Record<string, any> = { [xColumn]: row[0] !== null ? String(row[0]) : 'Item' };
          valueColumns.forEach((colName, idx) => {
            const rawCell = row[idx + 1];
            let num = typeof rawCell === 'number' ? rawCell : parseFloat(String(rawCell).replace(/[^0-9.-]/g, ''));
            item[colName] = isNaN(num) ? 0 : num;
          });
          return item;
        });

        return {
          chartData: dataset,
          xKey: xColumn,
          seriesKeys: valueColumns,
        };
      }
    }

    return {
      chartData: [],
      xKey: 'Category',
      seriesKeys: ['Value'],
    };
  }, [chart, tables]);

  const hasInteractiveData = chartData.length > 0 && seriesKeys.length > 0;

  const exportChartAsSvg = () => {
    const svgEl = document.querySelector(`#chart-container-${chart.title?.replace(/\s+/g, '-')} svg`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chart.title || 'Chart'}_Vector.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderChart = () => {
    if (!hasInteractiveData || viewType === 'image') {
      return (
        <div className="relative w-full h-full min-h-[260px] flex items-center justify-center group">
          {chart.image ? (
            <img
              src={chart.image}
              alt={chart.title}
              className="w-full h-auto max-h-72 object-contain mx-auto rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center text-neutral-400 text-xs py-10">
              <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
              <span>Static Image View</span>
            </div>
          )}
        </div>
      );
    }

    switch (viewType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {seriesKeys.map((sKey, i) => (
                <Bar
                  key={sKey}
                  dataKey={sKey}
                  fill={currentPalette[i % currentPalette.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {seriesKeys.map((sKey, i) => (
                <Line
                  key={sKey}
                  type="monotone"
                  dataKey={sKey}
                  stroke={currentPalette[i % currentPalette.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {seriesKeys.map((sKey, i) => (
                <Area
                  key={sKey}
                  type="monotone"
                  dataKey={sKey}
                  stroke={currentPalette[i % currentPalette.length]}
                  fill={currentPalette[i % currentPalette.length]}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie': {
        const primarySeries = seriesKeys[0] || 'Value';
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Pie
                data={chartData}
                dataKey={primarySeries}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={35}
                paddingAngle={3}
              >
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={currentPalette[idx % currentPalette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'radar': {
        return (
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={80}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {seriesKeys.map((sKey, i) => (
                <Radar
                  key={sKey}
                  name={sKey}
                  dataKey={sKey}
                  stroke={currentPalette[i % currentPalette.length]}
                  fill={currentPalette[i % currentPalette.length]}
                  fillOpacity={0.4}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );
      }

      case 'composed': {
        const primarySeries = seriesKeys[0];
        const secondarySeries = seriesKeys[1] || seriesKeys[0];
        return (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey={primarySeries} fill={currentPalette[0]} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey={secondarySeries} stroke={currentPalette[1] || currentPalette[0]} strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      }

      case 'scatter': {
        const primarySeries = seriesKeys[0];
        return (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} name={xKey} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis dataKey={primarySeries} name={primarySeries} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter name={primarySeries} data={chartData} fill={currentPalette[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }
    }
  };

  return (
    <figure className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col group transition hover:border-neutral-300">
      {/* Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-neutral-50/80 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Vector Chart Studio</span>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-2xs">
          {hasInteractiveData && (
            <>
              <button
                onClick={() => setViewType('bar')}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  viewType === 'bar' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('line')}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  viewType === 'line' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                }`}
                title="Line Chart"
              >
                <LineChartIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('area')}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  viewType === 'area' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                }`}
                title="Area Chart"
              >
                <AreaChartIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('pie')}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  viewType === 'pie' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                }`}
                title="Pie Chart"
              >
                <PieChartIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('radar')}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  viewType === 'radar' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                }`}
                title="Radar Chart"
              >
                <Compass className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewType('composed')}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  viewType === 'composed' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                }`}
                title="Dual-Axis Composed Chart"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>

              {/* Palette Switcher Dropdown */}
              <select
                value={activePalette}
                onChange={(e) => setActivePalette(e.target.value as any)}
                className="text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-600 cursor-pointer"
              >
                <option value="google">Google Theme</option>
                <option value="midnight">Midnight Glow</option>
                <option value="emerald">Nordic Emerald</option>
                <option value="sunset">Sunset Burst</option>
                <option value="pastel">Soft Pastel</option>
              </select>

              {/* Export SVG Button */}
              <button
                onClick={exportChartAsSvg}
                className="p-1.5 rounded-lg text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition cursor-pointer"
                title="Export High-Res Vector SVG"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {onZoom && (
            <button
              onClick={onZoom}
              className="p-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 transition cursor-pointer"
              title="Full Resolution Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Chart Body */}
      <div
        id={`chart-container-${chart.title?.replace(/\s+/g, '-')}`}
        className="relative bg-white dark:bg-neutral-900 p-4 flex-1 flex items-center justify-center min-h-[260px]"
      >
        {renderChart()}
      </div>

      {/* Caption & Title */}
      <figcaption className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 bg-neutral-50/50 dark:bg-neutral-800/40">
        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{chart.title}</p>
        {chart.caption && <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{chart.caption}</p>}
      </figcaption>
    </figure>
  );
};
