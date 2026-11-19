import React, { useState } from 'react';
import { Check, Copy, Play, Radio, Send, Terminal, Wifi, WifiOff } from 'lucide-react';
import type { DashboardState, DemoScenario } from '../types/water';
import {
  formatTimestamp,
  getConnectionLabel,
  getQualityGlyph,
  getQualityLabel,
  getQualityTextColor,
} from '../utils/formatters';

interface LiveMonitoringSectionProps {
  state: DashboardState;
  onSelectScenario: (scenario: DemoScenario) => Promise<void>;
  onTickDemo: () => Promise<void>;
  onIngestReading: (payload: {
    stationId: string;
    ph: number;
    turbidity: number;
    temperature: number | null;
    pipelineLocation: string;
  }) => Promise<void>;
}

const SCENARIOS: Array<{ id: DemoScenario; label: string; desc: string }> = [
  { id: 'normal', label: 'Normal Baseline', desc: 'Nominal pH 7.1–7.5 & turbidity < 1.0 NTU' },
  {
    id: 'turbidity_surge',
    label: 'Sediment Surge (High NTU)',
    desc: 'Triggers warning & critical turbidity alerts at ST-102 / ST-104',
  },
  {
    id: 'ph_acidic',
    label: 'Acidic pH Drift',
    desc: 'Drops ST-101 pH to ~5.85 (below 6.5 limit)',
  },
  {
    id: 'ph_alkaline',
    label: 'Alkaline pH Excursion',
    desc: 'Raises ST-105 pH to ~8.92 (above 8.5 limit)',
  },
  {
    id: 'sudden_spike',
    label: 'Sudden Step Anomaly',
    desc: 'Rapid ΔpH & ΔNTU shift at ST-104 for AI & delta detection',
  },
  {
    id: 'sensor_dropout',
    label: 'Sensor Dropout',
    desc: 'Simulates ST-103 hardware disconnect & connectivity alert',
  },
];

export const LiveMonitoringSection: React.FC<LiveMonitoringSectionProps> = ({
  state,
  onSelectScenario,
  onTickDemo,
  onIngestReading,
}) => {
  const [stationId, setStationId] = useState(state.stations[0]?.id || 'ST-101');
  const [phInput, setPhInput] = useState('7.25');
  const [turbInput, setTurbInput] = useState('0.55');
  const [tempInput, setTempInput] = useState('16.5');
  const [locationInput, setLocationInput] = useState('Main Trunk North (DN600)');
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlSnippet = `curl -X POST ${originUrl}/api/sensors/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "stationId": "ST-101",
    "ph": 7.24,
    "turbidity": 0.48,
    "temperature": 16.2,
    "pipelineLocation": "Main Trunk North (DN600)"
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ph = Number(phInput);
    const turbidity = Number(turbInput);
    const temp = tempInput.trim() === '' ? null : Number(tempInput);

    if (Number.isNaN(ph) || ph < 0 || ph > 14 || Number.isNaN(turbidity) || turbidity < 0) {
      setSubmitFeedback('Enter valid physical bounds: pH 0–14, Turbidity ≥ 0 NTU.');
      return;
    }

    setSubmitting(true);
    setSubmitFeedback(null);
    try {
      await onIngestReading({
        stationId,
        ph,
        turbidity,
        temperature: temp,
        pipelineLocation: locationInput,
      });
      setSubmitFeedback(`Telemetry packet accepted for ${stationId} and evaluated in real time.`);
    } catch (err) {
      setSubmitFeedback(err instanceof Error ? err.message : 'Ingestion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode-Specific Control Panel */}
      {state.mode === 'demo' ? (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-sky-700 font-semibold">
                DEMO DATA SIMULATOR ACTIVE
              </div>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                Interactive Distribution Scenario Controls
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Trigger realistic water-quality disturbances to test threshold alerts, sudden-change
                detection, and AI anomaly analysis without physical hardware.
              </p>
            </div>
            <button
              onClick={onTickDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              Emit Next Sample Now
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {SCENARIOS.map((sc) => {
              const active = state.activeDemoScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => onSelectScenario(sc.id)}
                  className={`text-left p-3 rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-50 border-sky-500 text-sky-950'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="text-xs font-semibold">{sc.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{sc.desc}</div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-emerald-700 font-semibold">
                LIVE HARDWARE INGESTION ENDPOINT
              </div>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                Connect Real IoT Sensors (REST API / MQTT-HTTP Bridge)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Stream real pH and turbidity readings from ESP32, Arduino, Raspberry Pi, or an MQTT
                broker bridge. Stations remain marked Disconnected until a valid reading arrives.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Manual / Field Telemetry Input Form */}
            <form
              onSubmit={handleManualSubmit}
              className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-600" />
                <span>Send Live Telemetry Packet (POST /api/sensors/ingest)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Station ID
                  </label>
                  <input
                    type="text"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    placeholder="ST-101"
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Pipeline Location
                  </label>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    pH Reading (0–14)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="14"
                    value={phInput}
                    onChange={(e) => setPhInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Turbidity (NTU)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={turbInput}
                    onChange={(e) => setTurbInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Water Temperature (°C, optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 rounded transition-colors cursor-pointer"
                >
                  {submitting ? 'Ingesting…' : 'Transmit Live Reading'}
                </button>
                {submitFeedback && (
                  <span className="text-[11px] text-slate-700 font-medium">{submitFeedback}</span>
                )}
              </div>
            </form>

            {/* Hardware cURL / MQTT Bridge Integration Guide */}
            <div className="lg:col-span-6 bg-slate-900 text-slate-100 rounded-md p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-sky-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Hardware HTTP POST / MQTT Bridge Payload
                </span>
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                >
                  {copiedCurl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedCurl ? 'Copied' : 'Copy cURL'}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
                {curlSnippet}
              </pre>
              <p className="text-[11px] text-slate-400 mt-2">
                Timeout threshold: {state.settings.sensorTimeoutSeconds}s without packet marks node
                Disconnected and raises a connectivity alert.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Live Station Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.stations.map((st) => {
          const r = st.latestReading;
          const isOnline = st.connectionStatus !== 'disconnected' && r !== null;

          return (
            <div
              key={st.id}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <span>{st.id}</span>
                    <span>·</span>
                    <span>{state.mode === 'demo' ? 'DEMO DATA' : 'LIVE NODE'}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{st.name}</h3>
                  <p className="text-xs text-slate-500">{st.pipelineSegment}</p>
                </div>

                <span className={`text-xs font-semibold whitespace-nowrap ${getQualityTextColor(st.qualityStatus)}`}>
                  {getQualityGlyph(st.qualityStatus)}{' '}
                  {st.qualityStatus === 'normal'
                    ? 'Nominal'
                    : st.qualityStatus === 'warning'
                      ? 'Warning'
                      : st.qualityStatus === 'critical'
                        ? 'Critical'
                        : 'Offline'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500">pH Level</div>
                  <div className="text-2xl font-mono font-bold tabular-nums text-slate-900 mt-0.5">
                    {isOnline ? r.ph.toFixed(2) : '—'}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {isOnline
                      ? `Δ ${r.deltaPh >= 0 ? '+' : ''}${r.deltaPh.toFixed(2)} pH`
                      : 'No packet'}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500">Turbidity</div>
                  <div className="text-2xl font-mono font-bold tabular-nums text-slate-900 mt-0.5">
                    {isOnline ? r.turbidity.toFixed(2) : '—'}
                    <span className="text-xs font-normal text-slate-400 ml-1">NTU</span>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {isOnline
                      ? `Δ ${r.deltaTurbidity >= 0 ? '+' : ''}${r.deltaTurbidity.toFixed(2)} NTU`
                      : 'No packet'}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-medium ${getQualityTextColor(st.qualityStatus)}`}>
                    {getQualityLabel(st.qualityStatus)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Connection</span>
                  <span className="inline-flex items-center gap-1 font-mono text-slate-700">
                    {st.connectionStatus === 'disconnected' ? (
                      <WifiOff className="w-3 h-3 text-slate-500" />
                    ) : st.connectionStatus === 'connected' ? (
                      <Wifi className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Radio className="w-3 h-3 text-sky-600" />
                    )}
                    {getConnectionLabel(st.connectionStatus)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Water Temp · Updated</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {isOnline && r.temperature !== null ? `${r.temperature.toFixed(1)}°C · ` : ''}
                    {formatTimestamp(st.lastSeenAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
