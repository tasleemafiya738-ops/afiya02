import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cpu,
  Info,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import type {
  DashboardState,
  NavSection,
} from '../types/water';
import {
  formatTimestamp,
  getConnectionLabel,
  getQualityGlyph,
  getQualityLabel,
  getQualityTextColor,
  getShortQualityLabel,
  getStationRecommendations,
} from '../utils/formatters';
import { TrendLineChart } from './TelemetryCharts';

interface OverviewSectionProps {
  state: DashboardState;
  onNavigate: (section: NavSection) => void;
  onRunAiAnalysis: () => void;
  aiLoading: boolean;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  state,
  onNavigate,
  onRunAiAnalysis,
  aiLoading,
}) => {
  const activeStations = state.stations.filter(
    (s) => s.connectionStatus !== 'disconnected' && s.latestReading !== null
  );

  const avgPh = activeStations.length
    ? activeStations.reduce((acc, s) => acc + (s.latestReading?.ph ?? 0), 0) /
      activeStations.length
    : null;

  const avgTurbidity = activeStations.length
    ? activeStations.reduce((acc, s) => acc + (s.latestReading?.turbidity ?? 0), 0) /
      activeStations.length
    : null;

  const peakTurbidity = activeStations.length
    ? Math.max(...activeStations.map((s) => s.latestReading?.turbidity ?? 0))
    : null;

  const openAlerts = state.alerts.filter((a) => !a.resolved);
  const criticalCount = openAlerts.filter((a) => a.severity === 'critical').length;
  const statAnomalies = state.statisticalSignals.filter((s) => s.isStatisticalAnomaly);

  // Overall network operational status (never claims water "safe" from pH & turbidity alone)
  const hasCriticalStation = state.stations.some((s) => s.qualityStatus === 'critical');
  const hasWarningStation = state.stations.some((s) => s.qualityStatus === 'warning');
  const allDisconnected = activeStations.length === 0;

  let networkHeadline = 'Parameters Within Reference Limits';
  let networkToneClass = 'text-emerald-700';
  if (allDisconnected) {
    networkHeadline = 'Awaiting Connected Hardware Telemetry';
    networkToneClass = 'text-slate-600';
  } else if (hasCriticalStation) {
    networkHeadline = 'Critical Parameter Excursion Detected';
    networkToneClass = 'text-red-700';
  } else if (hasWarningStation) {
    networkHeadline = 'Elevated Parameter Warning Active';
    networkToneClass = 'text-amber-700';
  }

  // Filter readings for primary preview station (most recent alert station or ST-101)
  const focusStation =
    state.stations.find((s) => s.qualityStatus === 'critical') ||
    state.stations.find((s) => s.qualityStatus === 'warning') ||
    state.stations[0];

  const previewReadings = focusStation
    ? state.readings.filter((r) => r.stationId === focusStation.id).slice(-40)
    : [];

  return (
    <div className="space-y-6">
      {/* Primary Focal Summary Strip */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
              <span>{state.mode === 'demo' ? 'DEMO DATA STREAM' : 'LIVE SENSOR NETWORK'}</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated {formatTimestamp(state.lastUpdated)}</span>
              <span aria-hidden="true">·</span>
              <span>{activeStations.length}/{state.stations.length} Stations Reporting</span>
            </div>
            <h2 className={`text-2xl font-bold tracking-tight ${networkToneClass}`}>
              {networkHeadline}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Continuous early-warning monitoring across drinking-water distribution pipelines.
              Configured reference bounds: pH {state.settings.phMin.toFixed(1)}–
              {state.settings.phMax.toFixed(1)}, turbidity target ≤{' '}
              {state.settings.turbidityTarget.toFixed(1)} NTU.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={onRunAiAnalysis}
              disabled={aiLoading || state.readings.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              {aiLoading ? 'Analyzing Telemetry…' : 'Run AI Anomaly Scan'}
            </button>
            <button
              onClick={() => onNavigate('live')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Live Stations
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4-Column KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Network Mean pH</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-slate-900">
              {avgPh !== null ? avgPh.toFixed(2) : '—'}
              <span className="text-xs font-normal text-slate-400 ml-1.5">pH</span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Limit {state.settings.phMin.toFixed(1)}–{state.settings.phMax.toFixed(1)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Mean / Peak Turbidity</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-slate-900">
              {avgTurbidity !== null ? avgTurbidity.toFixed(2) : '—'}
              <span className="text-xs font-normal text-slate-400 ml-1">NTU</span>
              {peakTurbidity !== null && (
                <span className="text-sm font-medium text-slate-500 ml-2">
                  (Peak {peakTurbidity.toFixed(2)})
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Target ≤ {state.settings.turbidityTarget.toFixed(1)} NTU
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Monitoring Stations</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-slate-900">
              {activeStations.length}
              <span className="text-sm font-normal text-slate-400 ml-1">
                / {state.stations.length}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-600" />
              <span>
                {state.mode === 'demo'
                  ? 'DEMO DATA stream'
                  : activeStations.length > 0
                    ? 'Hardware online'
                    : 'No hardware packets'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Active Alerts & Signals</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-slate-900">
              {openAlerts.length}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({criticalCount} critical)
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {statAnomalies.length} statistical anomaly signal(s)
            </div>
          </div>
        </div>
      </section>

      {/* Station Telemetry Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Distribution Station Status Overview
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time parameter compliance and connectivity per pipeline node
            </p>
          </div>
          <button
            onClick={() => onNavigate('map')}
            className="text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
          >
            Inspect on Pipeline Map →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Station</th>
                <th className="py-2.5 px-4">Pipeline Location</th>
                <th className="py-2.5 px-4 text-right">pH</th>
                <th className="py-2.5 px-4 text-right">Turbidity (NTU)</th>
                <th className="py-2.5 px-4 text-right">Temp (°C)</th>
                <th className="py-2.5 px-4">Water-Quality Status</th>
                <th className="py-2.5 px-4">Connection</th>
                <th className="py-2.5 px-4 text-right">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {state.stations.map((st) => {
                const online = st.connectionStatus !== 'disconnected' && st.latestReading;
                return (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <span className="font-mono text-sky-700 mr-1.5">{st.id}</span>
                      <span>{st.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{st.pipelineSegment}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {online ? st.latestReading!.ph.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {online ? st.latestReading!.turbidity.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {online && st.latestReading!.temperature !== null
                        ? st.latestReading!.temperature.toFixed(1)
                        : '—'}
                    </td>
                    <td className={`py-3 px-4 font-medium whitespace-nowrap ${getQualityTextColor(st.qualityStatus)}`}>
                      {getQualityGlyph(st.qualityStatus)} {getQualityLabel(st.qualityStatus)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {getConnectionLabel(st.connectionStatus)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTimestamp(st.lastSeenAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dual Trend Charts for Focus Station */}
      {focusStation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TrendLineChart
            title={`${focusStation.id} (${focusStation.name}) — pH Trend`}
            unit="pH"
            metric="ph"
            readings={previewReadings}
            settings={state.settings}
            height={215}
          />
          <TrendLineChart
            title={`${focusStation.id} (${focusStation.name}) — Turbidity Trend`}
            unit="NTU"
            metric="turbidity"
            readings={previewReadings}
            settings={state.settings}
            height={215}
          />
        </div>
      )}

      {/* Alerts & Operational Recommendations Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Recent Smart Alerts</span>
            </h3>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
            >
              View All ({openAlerts.length} Open)
            </button>
          </div>

          {openAlerts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded">
              No active threshold or connectivity alerts in current mode.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {openAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="py-3 first:pt-1 last:pb-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">
                      <span
                        className={
                          alert.severity === 'critical' ? 'text-red-700 mr-1.5' : 'text-amber-700 mr-1.5'
                        }
                      >
                        {alert.severity === 'critical' ? '■ CRITICAL' : '▲ WARNING'}
                      </span>
                      {alert.alertType}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {alert.stationId} · {formatTimestamp(alert.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Detected <span className="font-mono font-medium text-slate-800">{alert.detectedValue}</span>{' '}
                    ({alert.thresholdReference}). {alert.recommendedAction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <span>Actionable Operational Guidance</span>
            </h3>
            <button
              onClick={() => onNavigate('anomaly')}
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
            >
              AI Anomaly Details →
            </button>
          </div>

          <div className="space-y-2.5">
            {state.stations
              .filter((st) => st.qualityStatus !== 'normal' || st.connectionStatus === 'disconnected')
              .slice(0, 3)
              .map((st) => {
                const recs = getStationRecommendations(st, state.settings, state.alerts);
                return (
                  <div key={st.id} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-900">
                        {st.id} · {st.name}
                      </span>
                      <span className={`font-medium ${getQualityTextColor(st.qualityStatus)}`}>
                        {getShortQualityLabel(st.qualityStatus)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{recs[0]}</p>
                  </div>
                );
              })}

            {state.stations.every(
              (st) => st.qualityStatus === 'normal' && st.connectionStatus !== 'disconnected'
            ) && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600">
                All reporting stations are currently within configured pH and turbidity reference
                limits. Maintain scheduled probe calibration and routine laboratory sampling.
              </div>
            )}
          </div>

          {/* Scientific Limitation Disclaimer */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-md p-3 flex items-start gap-2.5 text-xs text-sky-950">
            <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Monitoring Scope & Verification Notice:</span> pH and
              turbidity are early-warning physical-chemical indicators only. Never declare drinking
              water microbiologically or chemically safe based solely on these two parameters;
              laboratory testing and sensor calibration are required to confirm potability.
            </div>
          </div>
        </div>
      </div>

      {/* Explicit Hardware Status Note if Live & Empty */}
      {state.mode === 'live' && activeStations.length === 0 && (
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <ShieldAlert className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">Live Sensor Mode — Hardware Disconnected:</span>{' '}
              No physical IoT sensors are currently transmitting to <code className="font-mono">/api/sensors/ingest</code>.
              AquaGuard AI does not simulate live connections. Connect an ESP32/MQTT bridge or switch to Demo Mode to explore simulated telemetry.
            </div>
          </div>
          <button
            onClick={() => onNavigate('live')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded cursor-pointer whitespace-nowrap"
          >
            Configure Live Sensor Input
          </button>
        </div>
      )}
    </div>
  );
};
