import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Search } from 'lucide-react';
import type { DashboardState } from '../types/water';
import { formatTimestamp } from '../utils/formatters';

interface AlertsSectionProps {
  state: DashboardState;
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
}

export const AlertsSection: React.FC<AlertsSectionProps> = ({
  state,
  onAcknowledge,
  onResolve,
}) => {
  const [filterTab, setFilterTab] = useState<'active' | 'critical' | 'warning' | 'resolved' | 'all'>(
    'active'
  );
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return state.alerts.filter((a) => {
      if (filterTab === 'active' && a.resolved) return false;
      if (filterTab === 'critical' && (a.resolved || a.severity !== 'critical')) return false;
      if (filterTab === 'warning' && (a.resolved || a.severity !== 'warning')) return false;
      if (filterTab === 'resolved' && !a.resolved) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          a.stationId.toLowerCase().includes(q) ||
          a.alertType.toLowerCase().includes(q) ||
          a.pipelineLocation.toLowerCase().includes(q) ||
          a.recommendedAction.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.alerts, filterTab, search]);

  const activeCount = state.alerts.filter((a) => !a.resolved).length;
  const criticalCount = state.alerts.filter((a) => !a.resolved && a.severity === 'critical').length;

  return (
    <div className="space-y-5">
      {/* Header & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-600" />
              <span>Smart Alerts & Notifications</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeCount} open alert(s) ({criticalCount} critical) · Rule-based threshold,
              sudden-change, and sensor connectivity events
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search station or alert type…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-sky-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
          {(
            [
              { id: 'active', label: `Open (${activeCount})` },
              { id: 'critical', label: `Critical (${criticalCount})` },
              { id: 'warning', label: 'Warnings' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'all', label: 'All Events' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center text-xs text-slate-500">
          No alerts match the selected filter in {state.mode === 'demo' ? 'Demo Mode' : 'Live Mode'}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white border rounded-lg p-5 space-y-3 ${
                alert.resolved
                  ? 'border-slate-200 opacity-75'
                  : alert.severity === 'critical'
                    ? 'border-red-300'
                    : 'border-amber-300'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`font-bold ${
                        alert.resolved
                          ? 'text-emerald-700'
                          : alert.severity === 'critical'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {alert.resolved
                        ? '✓ RESOLVED'
                        : alert.severity === 'critical'
                          ? '■ CRITICAL'
                          : '▲ WARNING'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono text-sky-700 font-semibold">{alert.stationId}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="text-slate-500">{alert.pipelineLocation}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono text-slate-500">
                      {alert.isDemo ? 'DEMO DATA' : 'LIVE'}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{alert.alertType}</h3>
                </div>

                <div className="text-right text-xs font-mono tabular-nums text-slate-500">
                  <div>{formatTimestamp(alert.timestamp)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 uppercase">
                    {alert.category.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-3">
                <div>
                  <span className="text-slate-500">Detected Value: </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {alert.detectedValue}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Reference Limit: </span>
                  <span className="font-mono text-slate-700">{alert.thresholdReference}</span>
                </div>
                <div className="md:col-span-2 text-slate-600">{alert.explanation}</div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-xs text-slate-700 max-w-3xl">
                  <span className="font-semibold text-slate-900">Recommended Next Action: </span>
                  {alert.recommendedAction}
                </div>

                {!alert.resolved && (
                  <div className="flex items-center gap-2 shrink-0">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => onResolve(alert.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
