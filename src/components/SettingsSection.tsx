import React, { useState } from 'react';
import { Info, Plus, RotateCcw, Save, Sliders } from 'lucide-react';
import type { DashboardState, SystemMode, ThresholdSettings } from '../types/water';

interface SettingsSectionProps {
  state: DashboardState;
  onUpdateSettings: (settings: Partial<ThresholdSettings>) => Promise<void>;
  onSwitchMode: (mode: SystemMode) => Promise<void>;
  onAddStation: (station: {
    id: string;
    name: string;
    pipelineSegment: string;
    zone: string;
    sensorModel: string;
  }) => Promise<void>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  state,
  onUpdateSettings,
  onSwitchMode,
  onAddStation,
}) => {
  const [form, setForm] = useState<ThresholdSettings>(state.settings);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [newStationId, setNewStationId] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newSegment, setNewSegment] = useState('');
  const [newZone, setNewZone] = useState('');
  const [newModel, setNewModel] = useState('ESP32-S3 + pH-4502C / SEN0189');
  const [stationMsg, setStationMsg] = useState<string | null>(null);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phMin >= form.phMax) {
      setSaveMessage('pH Minimum must be strictly less than pH Maximum.');
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      await onUpdateSettings(form);
      setSaveMessage('Reference thresholds updated and applied across all monitoring rules.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save thresholds.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const defaults: ThresholdSettings = {
      phMin: 6.5,
      phMax: 8.5,
      turbidityTarget: 1.0,
      turbidityWarning: 1.0,
      turbidityCritical: 4.0,
      phSuddenDelta: 0.45,
      turbiditySuddenDelta: 0.75,
      sensorTimeoutSeconds: 90,
    };
    setForm(defaults);
    setSaving(true);
    try {
      await onUpdateSettings(defaults);
      setSaveMessage('Restored initial drinking-water reference limits (pH 6.5–8.5, Turbidity 1.0 NTU target).');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationId.trim() || !newStationName.trim() || !newSegment.trim()) return;
    try {
      await onAddStation({
        id: newStationId.trim().toUpperCase(),
        name: newStationName.trim(),
        pipelineSegment: newSegment.trim(),
        zone: newZone.trim() || 'Distribution Zone',
        sensorModel: newModel.trim(),
      });
      setStationMsg(`Registered monitoring node ${newStationId.trim().toUpperCase()}.`);
      setNewStationId('');
      setNewStationName('');
      setNewSegment('');
      setNewZone('');
    } catch (err) {
      setStationMsg(err instanceof Error ? err.message : 'Failed to add station.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Mode Selector */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Telemetry Operating Mode</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Switch between simulated demonstration streams (clearly marked DEMO DATA) and real
            physical IoT hardware ingestion.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            onClick={() => onSwitchMode('demo')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
              state.mode === 'demo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Demo Mode (Simulated)
          </button>
          <button
            onClick={() => onSwitchMode('live')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
              state.mode === 'live'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Sensor Mode (IoT API)
          </button>
        </div>
      </section>

      {/* Configurable Water Quality Thresholds */}
      <form
        onSubmit={handleSaveThresholds}
        className="bg-white border border-slate-200 rounded-lg p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>Configurable Water-Quality Reference Limits</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust thresholds to match local municipal, WHO, or EPA distribution standards
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              pH Minimum Limit
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="14"
              value={form.phMin}
              onChange={(e) => setForm({ ...form, phMin: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              pH Maximum Limit
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="14"
              value={form.phMax}
              onChange={(e) => setForm({ ...form, phMax: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Turbidity Preferred Target (NTU)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.turbidityTarget}
              onChange={(e) => setForm({ ...form, turbidityTarget: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Turbidity Warning Threshold (NTU)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.turbidityWarning}
              onChange={(e) => setForm({ ...form, turbidityWarning: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Turbidity Critical Threshold (NTU)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.turbidityCritical}
              onChange={(e) => setForm({ ...form, turbidityCritical: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sudden Δ pH Step Alert
            </label>
            <input
              type="number"
              step="0.05"
              min="0.05"
              value={form.phSuddenDelta}
              onChange={(e) => setForm({ ...form, phSuddenDelta: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sudden Δ Turbidity Alert (NTU)
            </label>
            <input
              type="number"
              step="0.05"
              min="0.05"
              value={form.turbiditySuddenDelta}
              onChange={(e) => setForm({ ...form, turbiditySuddenDelta: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Hardware Timeout (Seconds)
            </label>
            <input
              type="number"
              step="5"
              min="15"
              value={form.sensorTimeoutSeconds}
              onChange={(e) => setForm({ ...form, sensorTimeoutSeconds: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Threshold Configuration'}
          </button>
          {saveMessage && <span className="text-xs font-medium text-emerald-700">{saveMessage}</span>}
        </div>
      </form>

      {/* Register Additional Monitoring Station */}
      <form
        onSubmit={handleRegisterStation}
        className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-600" />
            <span>Register Distribution Monitoring Station</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add a new low-cost IoT node ID to track in Live Sensor Mode and pipeline analytics
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={newStationId}
            onChange={(e) => setNewStationId(e.target.value)}
            placeholder="Station ID (e.g. ST-107)"
            className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            required
          />
          <input
            type="text"
            value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)}
            placeholder="Station Name"
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            required
          />
          <input
            type="text"
            value={newSegment}
            onChange={(e) => setNewSegment(e.target.value)}
            placeholder="Pipeline Segment"
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
            required
          />
          <input
            type="text"
            value={newZone}
            onChange={(e) => setNewZone(e.target.value)}
            placeholder="Zone / District"
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
          />
          <input
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="Hardware / Probe"
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-sky-600"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded transition-colors cursor-pointer"
          >
            Add Monitoring Station
          </button>
          {stationMsg && <span className="text-xs font-medium text-sky-700">{stationMsg}</span>}
        </div>
      </form>

      {/* Calibration, Accuracy & System Limitations */}
      <section className="bg-sky-50/70 border border-sky-200 rounded-lg p-5 space-y-2.5 text-xs text-sky-950">
        <div className="flex items-center gap-2 font-semibold text-sm text-sky-950">
          <Info className="w-4 h-4 text-sky-700" />
          <span>Calibration Requirements, Limitations & Scientific Scope</span>
        </div>
        <ul className="space-y-1.5 leading-relaxed list-disc pl-5">
          <li>
            <strong>No Single-Parameter Potability Claims:</strong> AquaGuard AI monitors pH and
            turbidity (plus optional temperature) as continuous early-warning indicators. It never
            declares drinking water safe based solely on these readings; microbiological (e.g.
            coliforms), disinfectant residual, and heavy-metal compliance require certified
            laboratory analysis.
          </li>
          <li>
            <strong>Sensor Calibration & Biofouling:</strong> Low-cost glass pH electrodes and
            optical turbidity probes drift over time and accumulate biofilm or air bubbles.
            Two-point buffer calibration (pH 4.01 / 7.00 / 10.01) and formazin turbidity checks
            should be performed every 14–30 days.
          </li>
          <li>
            <strong>Detection Uncertainty:</strong> Neither threshold rules nor AI pattern analysis
            offer zero-error detection. Alerts indicate parameter shifts requiring human inspection,
            probe cleaning, and confirmatory grab sampling rather than identifying specific
            contaminants.
          </li>
        </ul>
      </section>
    </div>
  );
};
