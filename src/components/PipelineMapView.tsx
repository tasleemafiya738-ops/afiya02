import React, { useState } from 'react';
import { AlertTriangle, MapPin, Radio, Wrench } from 'lucide-react';
import type {
  MonitoringStation,
  SystemMode,
  ThresholdSettings,
  WaterAlert,
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

interface PipelineMapViewProps {
  mode: SystemMode;
  stations: MonitoringStation[];
  alerts: WaterAlert[];
  settings: ThresholdSettings;
}

const PIPELINE_EDGES: Array<{ from: string; to: string; label: string }> = [
  { from: 'ST-101', to: 'ST-102', label: 'DN600 Main Trunk' },
  { from: 'ST-102', to: 'ST-103', label: 'DN300 East Header' },
  { from: 'ST-102', to: 'ST-104', label: 'DN250 Central Sub-Main' },
  { from: 'ST-102', to: 'ST-106', label: 'DN250 West Pressure Line' },
  { from: 'ST-104', to: 'ST-105', label: 'DN200 South Terminal' },
  { from: 'ST-103', to: 'ST-105', label: 'East-South Tie-In' },
];

export const PipelineMapView: React.FC<PipelineMapViewProps> = ({
  mode,
  stations,
  alerts,
  settings,
}) => {
  const [selectedId, setSelectedId] = useState<string>(stations[0]?.id || 'ST-101');
  const selectedStation = stations.find((s) => s.id === selectedId) || stations[0];

  const getStationNodeColors = (st: MonitoringStation) => {
    switch (st.qualityStatus) {
      case 'normal':
        return { stroke: '#059669', fill: '#ECFDF5', text: '#065F46' };
      case 'warning':
        return { stroke: '#D97706', fill: '#FFFBEB', text: '#92400E' };
      case 'critical':
        return { stroke: '#DC2626', fill: '#FEF2F2', text: '#991B1B' };
      case 'disconnected':
        return { stroke: '#64748B', fill: '#F1F5F9', text: '#334155' };
    }
  };

  const stationById = new Map(stations.map((s) => [s.id, s]));

  const selectedAlerts = selectedStation
    ? alerts.filter((a) => a.stationId === selectedStation.id && !a.resolved)
    : [];

  const recommendations = selectedStation
    ? getStationRecommendations(selectedStation, settings, alerts)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Distribution Pipeline Telemetry Map
          </h2>
          <p className="text-sm text-slate-600">
            {mode === 'demo'
              ? 'Sample Municipal Distribution Network (Demo Locations) — Click any monitoring node to inspect live readings and active alerts.'
              : 'Configured field distribution network — Displaying live station connectivity and real-time alert markers.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <span className="text-emerald-700">● Nominal</span>
          <span className="text-amber-700">▲ Warning</span>
          <span className="text-red-700">■ Critical</span>
          <span className="text-slate-500">○ Disconnected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Interactive Schematic Map */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-4 flex flex-col">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span className="font-mono">
              {mode === 'demo'
                ? 'DEMO SCHEMATIC · SAMPLE MUNICIPAL ZONE A–F'
                : 'LIVE TELEMETRY SCHEMATIC'}
            </span>
            <span className="font-mono tabular-nums">
              {stations.length} Active Nodes · {alerts.filter((a) => !a.resolved).length} Open Alerts
            </span>
          </div>

          <div className="relative flex-1 bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
            <svg viewBox="0 0 1000 500" className="w-full h-auto min-h-[340px]">
              {/* Subtle Engineering Coordinate Grid */}
              <defs>
                <pattern id="pipeGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="0.7"
                  />
                </pattern>
              </defs>
              <rect width="1000" height="500" fill="url(#pipeGrid)" />

              {/* Water Treatment Source Reservoir Graphic */}
              <g transform="translate(36, 40)">
                <rect
                  width="115"
                  height="48"
                  rx="4"
                  fill="#E0F2FE"
                  stroke="#0284C7"
                  strokeWidth="1.5"
                />
                <text
                  x="57"
                  y="21"
                  textAnchor="middle"
                  className="fill-sky-900 text-[10px] font-semibold"
                >
                  WTP Reservoir
                </text>
                <text
                  x="57"
                  y="36"
                  textAnchor="middle"
                  className="fill-sky-700 text-[9px] font-mono"
                >
                  Supply Head
                </text>
              </g>
              <line
                x1="93"
                y1="88"
                x2="130"
                y2="120"
                stroke="#0284C7"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Pipeline Edges */}
              {PIPELINE_EDGES.map((edge) => {
                const a = stationById.get(edge.from);
                const b = stationById.get(edge.to);
                if (!a || !b) return null;

                const hasAlertPipe =
                  a.qualityStatus === 'critical' ||
                  b.qualityStatus === 'critical' ||
                  a.qualityStatus === 'warning' ||
                  b.qualityStatus === 'warning';

                const strokeColor =
                  a.qualityStatus === 'critical' || b.qualityStatus === 'critical'
                    ? '#FCA5A5'
                    : hasAlertPipe
                      ? '#FCD34D'
                      : '#7DD3FC';

                const midX = (a.coordinates.x + b.coordinates.x) / 2;
                const midY = (a.coordinates.y + b.coordinates.y) / 2;

                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <line
                      x1={a.coordinates.x}
                      y1={a.coordinates.y}
                      x2={b.coordinates.x}
                      y2={b.coordinates.y}
                      stroke={strokeColor}
                      strokeWidth="7"
                      strokeLinecap="round"
                    />
                    <line
                      x1={a.coordinates.x}
                      y1={a.coordinates.y}
                      x2={b.coordinates.x}
                      y2={b.coordinates.y}
                      stroke="#0369A1"
                      strokeWidth="1.5"
                      strokeDasharray="6 6"
                    />
                    <rect
                      x={midX - 58}
                      y={midY - 9}
                      width="116"
                      height="18"
                      rx="3"
                      fill="#FFFFFF"
                      fillOpacity="0.92"
                      stroke="#E2E8F0"
                      strokeWidth="0.8"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      className="fill-slate-600 text-[9px] font-mono"
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}

              {/* Extra dynamically registered stations outside base schematic */}
              {stations.map((st) => {
                const colors = getStationNodeColors(st);
                const isSelected = selectedStation?.id === st.id;
                const openCount = alerts.filter(
                  (a) => a.stationId === st.id && !a.resolved
                ).length;

                return (
                  <g
                    key={st.id}
                    transform={`translate(${st.coordinates.x}, ${st.coordinates.y})`}
                    onClick={() => setSelectedId(st.id)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedId(st.id);
                    }}
                  >
                    {isSelected && (
                      <circle
                        r="30"
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    )}

                    {openCount > 0 && (
                      <circle
                        r="25"
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth="1.5"
                        strokeOpacity="0.55"
                      />
                    )}

                    <circle
                      r="19"
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="2.5"
                    />
                    <text
                      y="4"
                      textAnchor="middle"
                      fill={colors.text}
                      className="text-[11px] font-mono font-bold"
                    >
                      {st.id.replace('ST-', '')}
                    </text>

                    {/* Station Callout Box */}
                    <g transform="translate(-72, 26)">
                      <rect
                        width="144"
                        height="44"
                        rx="4"
                        fill="#FFFFFF"
                        stroke={isSelected ? '#0284C7' : '#CBD5E1'}
                        strokeWidth={isSelected ? '1.5' : '1'}
                      />
                      <text
                        x="72"
                        y="15"
                        textAnchor="middle"
                        className="fill-slate-900 text-[10px] font-semibold"
                      >
                        {st.id} · {getShortQualityLabel(st.qualityStatus)}
                      </text>
                      <text
                        x="72"
                        y="32"
                        textAnchor="middle"
                        className="fill-slate-600 text-[10px] font-mono tabular-nums"
                      >
                        {st.latestReading && st.connectionStatus !== 'disconnected'
                          ? `pH ${st.latestReading.ph.toFixed(2)} | ${st.latestReading.turbidity.toFixed(2)} NTU`
                          : 'Offline · No stream'}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Station Inspection Panel */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          {selectedStation ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>{selectedStation.id}</span>
                    <span>·</span>
                    <span>{mode === 'demo' ? 'DEMO DATA' : 'LIVE NODE'}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mt-1">
                    {selectedStation.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedStation.pipelineSegment} · {selectedStation.zone}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${getQualityTextColor(selectedStation.qualityStatus)}`}
                >
                  {getQualityGlyph(selectedStation.qualityStatus)}{' '}
                  {getShortQualityLabel(selectedStation.qualityStatus)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500 font-medium">Current pH</div>
                  <div className="text-2xl font-mono font-semibold tabular-nums text-slate-900 mt-1">
                    {selectedStation.latestReading &&
                    selectedStation.connectionStatus !== 'disconnected'
                      ? selectedStation.latestReading.ph.toFixed(2)
                      : '—'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Limit {settings.phMin.toFixed(1)}–{settings.phMax.toFixed(1)}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500 font-medium">Turbidity</div>
                  <div className="text-2xl font-mono font-semibold tabular-nums text-slate-900 mt-1">
                    {selectedStation.latestReading &&
                    selectedStation.connectionStatus !== 'disconnected'
                      ? selectedStation.latestReading.turbidity.toFixed(2)
                      : '—'}
                    <span className="text-xs font-normal text-slate-400 ml-1">NTU</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Target ≤ {settings.turbidityTarget.toFixed(1)} NTU
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Operational Status</span>
                  <span className={`font-medium ${getQualityTextColor(selectedStation.qualityStatus)}`}>
                    {getQualityLabel(selectedStation.qualityStatus)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Radio className="w-3 h-3" /> Connection
                  </span>
                  <span className="font-mono text-slate-800">
                    {getConnectionLabel(selectedStation.connectionStatus)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Updated</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    {formatTimestamp(selectedStation.lastSeenAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hardware / Calibration</span>
                  <span className="font-mono text-slate-700 text-right">
                    {selectedStation.lastCalibration}
                  </span>
                </div>
              </div>

              {selectedAlerts.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-md p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span>{selectedAlerts.length} Active Alert(s) at Station</span>
                  </div>
                  {selectedAlerts.slice(0, 2).map((a) => (
                    <div key={a.id} className="text-xs text-amber-900">
                      <span className="font-medium">{a.alertType}</span> ·{' '}
                      <span className="font-mono">{a.detectedValue}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1.5">
                  <Wrench className="w-3.5 h-3.5 text-sky-600" />
                  <span>Recommended Next Action</span>
                </div>
                <ul className="space-y-1.5">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-600 leading-relaxed">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Select a station on the map to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
};
