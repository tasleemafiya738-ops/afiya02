import React, { useMemo, useState } from 'react';
import type { DashboardState } from '../types/water';
import { DailyWeeklyComparisonChart, TrendLineChart } from './TelemetryCharts';

interface AnalyticsSectionProps {
  state: DashboardState;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ state }) => {
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [windowFilter, setWindowFilter] = useState<'recent' | '24h' | '7d'>('7d');

  const filteredReadings = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      windowFilter === 'recent'
        ? 3 * 60 * 60 * 1000
        : windowFilter === '24h'
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;

    return state.readings.filter((r) => {
      if (selectedStation !== 'all' && r.stationId !== selectedStation) return false;
      return now - new Date(r.timestamp).getTime() <= cutoffMs;
    });
  }, [state.readings, selectedStation, windowFilter]);

  const stationStats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return state.stations.map((st) => {
      const all = state.readings.filter((r) => r.stationId === st.id);
      const day = all.filter((r) => now - new Date(r.timestamp).getTime() <= dayMs);

      const calc = (arr: typeof all) => {
        if (arr.length === 0) return null;
        const phVals = arr.map((r) => r.ph);
        const turbVals = arr.map((r) => r.turbidity);
        const phMean = phVals.reduce((a, b) => a + b, 0) / phVals.length;
        const turbMean = turbVals.reduce((a, b) => a + b, 0) / turbVals.length;
        const phStd = Math.sqrt(
          phVals.reduce((s, v) => s + Math.pow(v - phMean, 2), 0) / phVals.length
        );
        const turbStd = Math.sqrt(
          turbVals.reduce((s, v) => s + Math.pow(v - turbMean, 2), 0) / turbVals.length
        );
        const exceedances = arr.filter((r) => r.qualityStatus !== 'normal').length;

        return {
          count: arr.length,
          phMin: Math.min(...phVals),
          phMax: Math.max(...phVals),
          phMean,
          phStd,
          turbMin: Math.min(...turbVals),
          turbMax: Math.max(...turbVals),
          turbMean,
          turbStd,
          exceedances,
        };
      };

      const weekStat = calc(all);
      const dayStat = calc(day);

      return {
        station: st,
        week: weekStat,
        day: dayStat,
      };
    });
  }, [state.stations, state.readings]);

  const phComparisonItems = stationStats
    .filter((s) => s.week !== null)
    .map((s) => ({
      stationId: s.station.id,
      stationName: s.station.name,
      dailyMean: s.day?.phMean ?? s.week!.phMean,
      weeklyMean: s.week!.phMean,
    }));

  const turbComparisonItems = stationStats
    .filter((s) => s.week !== null)
    .map((s) => ({
      stationId: s.station.id,
      stationName: s.station.name,
      dailyMean: s.day?.turbMean ?? s.week!.turbMean,
      weeklyMean: s.week!.turbMean,
    }));

  return (
    <div className="space-y-6">
      {/* Controls Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Water Quality Historical Trends & Station Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {state.mode === 'demo' ? 'DEMO DATA · ' : 'LIVE SENSOR DATA · '}
            Hover over chart lines to inspect exact timestamped measurements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            aria-label="Filter analytics by monitoring station"
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-sky-600"
          >
            <option value="all">All Stations (Combined Network)</option>
            {state.stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.id} — {st.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(
              [
                { id: 'recent', label: '3 Hours' },
                { id: '24h', label: '24 Hours' },
                { id: '7d', label: '7 Days' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setWindowFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  windowFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary pH and Turbidity Trend Graphs */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <TrendLineChart
          title={`pH Trend — ${selectedStation === 'all' ? 'All Monitoring Stations' : selectedStation}`}
          unit="pH"
          metric="ph"
          readings={filteredReadings}
          settings={state.settings}
          height={250}
        />
        <TrendLineChart
          title={`Turbidity Trend — ${selectedStation === 'all' ? 'All Monitoring Stations' : selectedStation}`}
          unit="NTU"
          metric="turbidity"
          readings={filteredReadings}
          settings={state.settings}
          height={250}
        />
      </div>

      {/* Daily vs Weekly Comparison Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DailyWeeklyComparisonChart
          title="Station-Wise Turbidity: Daily (24h) vs. Weekly (7d)"
          unit="NTU"
          items={turbComparisonItems}
          referenceLine={state.settings.turbidityWarning}
        />
        <DailyWeeklyComparisonChart
          title="Station-Wise pH: Daily (24h) vs. Weekly (7d)"
          unit="pH"
          items={phComparisonItems}
        />
      </div>

      {/* Station-Wise Summary Statistics Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Station-Wise Statistical Water-Quality Summary
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mean, range, dispersion (σ), and threshold exceedance counts across recorded samples
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Station</th>
                <th className="py-2.5 px-4 text-right">Samples</th>
                <th className="py-2.5 px-4 text-right">pH Mean (±σ)</th>
                <th className="py-2.5 px-4 text-right">pH Min–Max</th>
                <th className="py-2.5 px-4 text-right">Turbidity Mean (±σ)</th>
                <th className="py-2.5 px-4 text-right">Turbidity Peak</th>
                <th className="py-2.5 px-4 text-right">Limit Exceedances</th>
                <th className="py-2.5 px-4 text-right">Last Calibration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {stationStats.map(({ station, week }) => (
                <tr key={station.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                    <span className="font-mono text-sky-700 mr-1.5">{station.id}</span>
                    {station.name}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {week ? week.count : 0}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {week ? `${week.phMean.toFixed(2)} (±${week.phStd.toFixed(2)})` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {week ? `${week.phMin.toFixed(2)}–${week.phMax.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {week
                      ? `${week.turbMean.toFixed(2)} (±${week.turbStd.toFixed(2)}) NTU`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {week ? `${week.turbMax.toFixed(2)} NTU` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {week ? (
                      <span
                        className={
                          week.exceedances > 0 ? 'font-semibold text-amber-700' : 'text-emerald-700'
                        }
                      >
                        {week.exceedances}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {station.lastCalibration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
