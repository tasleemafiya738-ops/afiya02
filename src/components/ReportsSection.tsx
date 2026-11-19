import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Search } from 'lucide-react';
import type { DashboardState } from '../types/water';
import {
  formatTimestamp,
  getQualityGlyph,
  getQualityTextColor,
  getShortQualityLabel,
} from '../utils/formatters';

interface ReportsSectionProps {
  state: DashboardState;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({ state }) => {
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(60);

  const filteredReadings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.readings
      .slice()
      .reverse()
      .filter((r) => {
        if (stationFilter !== 'all' && r.stationId !== stationFilter) return false;
        if (statusFilter !== 'all' && r.qualityStatus !== statusFilter) return false;
        if (q) {
          return (
            r.stationId.toLowerCase().includes(q) ||
            r.pipelineLocation.toLowerCase().includes(q) ||
            r.source.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [state.readings, stationFilter, statusFilter, query]);

  const visibleRows = filteredReadings.slice(0, limit);

  const handleDownloadCsv = () => {
    window.location.href = `/api/reports/csv?stationId=${encodeURIComponent(stationFilter)}`;
  };

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>Historical Telemetry Ledger & CSV Reports</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredReadings.length} historical record(s) in{' '}
              {state.mode === 'demo' ? 'DEMO DATA mode' : 'LIVE SENSOR mode'}
            </p>
          </div>

          <button
            onClick={handleDownloadCsv}
            disabled={state.readings.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download CSV Report
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by station or pipeline…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-sky-600"
            />
          </div>

          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            aria-label="Filter report by station"
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-sky-600"
          >
            <option value="all">All Monitoring Stations</option>
            {state.stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.id} — {st.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter report by quality status"
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-sky-600"
          >
            <option value="all">All Quality Statuses</option>
            <option value="normal">Nominal Only</option>
            <option value="warning">Warning Only</option>
            <option value="critical">Critical Only</option>
          </select>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {visibleRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No historical readings match your filter criteria.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Station</th>
                    <th className="py-2.5 px-4">Pipeline Location</th>
                    <th className="py-2.5 px-4 text-right">pH</th>
                    <th className="py-2.5 px-4 text-right">Turbidity (NTU)</th>
                    <th className="py-2.5 px-4 text-right">Temp (°C)</th>
                    <th className="py-2.5 px-4 text-right">Δ pH / Δ NTU</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Origin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visibleRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatTimestamp(r.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-sky-700 whitespace-nowrap">
                        {r.stationId}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{r.pipelineLocation}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {r.ph.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {r.turbidity.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {r.temperature !== null ? r.temperature.toFixed(1) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {r.deltaPh >= 0 ? '+' : ''}
                        {r.deltaPh.toFixed(2)} / {r.deltaTurbidity >= 0 ? '+' : ''}
                        {r.deltaTurbidity.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-medium whitespace-nowrap ${getQualityTextColor(r.qualityStatus)}`}
                      >
                        {getQualityGlyph(r.qualityStatus)} {getShortQualityLabel(r.qualityStatus)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {r.isDemo ? 'DEMO DATA' : r.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredReadings.length > limit && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing {visibleRows.length} of {filteredReadings.length} records
                </span>
                <button
                  onClick={() => setLimit((prev) => prev + 60)}
                  className="font-semibold text-sky-700 hover:underline cursor-pointer"
                >
                  Load 60 more rows
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
