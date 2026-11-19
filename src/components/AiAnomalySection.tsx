import React, { useState } from 'react';
import { AlertCircle, BrainCircuit, GitCompare, ShieldCheck, Wrench } from 'lucide-react';
import type { DashboardState } from '../types/water';
import { formatTimestamp } from '../utils/formatters';

interface AiAnomalySectionProps {
  state: DashboardState;
  onRunAiAnalysis: (stationId?: string) => Promise<void>;
  aiLoading: boolean;
  aiError: string | null;
}

export const AiAnomalySection: React.FC<AiAnomalySectionProps> = ({
  state,
  onRunAiAnalysis,
  aiLoading,
  aiError,
}) => {
  const [targetStation, setTargetStation] = useState<string>('all');
  const latestReport = state.aiReports[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header & Execution Controls */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-mono text-sky-700 font-semibold">
              <BrainCircuit className="w-4 h-4" />
              <span>AI PATTERN ANALYSIS & STATISTICAL BASELINE COMPARISON</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              AI-Based Anomaly Detection Module
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Combines rolling z-score / rate-of-change detection with Gemini AI pattern reasoning
              to spot unusual distribution trends, compare readings against historical baselines, and
              explain why alerts occur — even before hard regulatory thresholds are breached.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={targetStation}
              onChange={(e) => setTargetStation(e.target.value)}
              aria-label="Target station for AI analysis"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-sky-600"
            >
              <option value="all">Analyze All Stations</option>
              {state.stations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.id} — {st.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => onRunAiAnalysis(targetStation)}
              disabled={aiLoading || state.readings.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <BrainCircuit className="w-4 h-4" />
              {aiLoading ? 'Running AI Analysis…' : 'Analyze Telemetry with AI'}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{aiError}</span>
          </div>
        )}
      </section>

      {/* Distinction Framework: Rule Thresholds vs AI Anomaly Predictions */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>1. Rule-Based Threshold Alerts (Deterministic)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Triggers immediately whenever a reading crosses fixed operator limits (pH outside{' '}
            <span className="font-mono">
              {state.settings.phMin.toFixed(1)}–{state.settings.phMax.toFixed(1)}
            </span>
            , turbidity above{' '}
            <span className="font-mono">{state.settings.turbidityWarning.toFixed(1)} NTU</span>, or
            sensor timeout). Deterministic, zero-ambiguity boundary checks.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <GitCompare className="w-4 h-4 text-sky-600" />
            <span>2. AI & Statistical Pattern Detection (Contextual)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Evaluates rate-of-change (Δ), rolling 30-point z-scores, and multi-station correlation
            to flag abnormal behavior <span className="font-semibold">before</span> hard limits fail
            (e.g., an abrupt +0.60 pH jump inside 6.5–8.5). Does not identify specific contaminants
            or guarantee 0% false positives.
          </p>
        </div>
      </section>

      {/* Real-Time Statistical Baseline Signals Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Continuous Statistical Baseline Signals ({state.mode === 'demo' ? 'DEMO DATA' : 'LIVE'})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Compares latest reading against each station’s 30-point rolling mean and standard
              deviation
            </p>
          </div>
        </div>

        {state.statisticalSignals.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            At least 3 readings per station are required to compute rolling statistical baselines.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Station</th>
                  <th className="py-2.5 px-4 text-right">pH Baseline (μ)</th>
                  <th className="py-2.5 px-4 text-right">pH Z-Score</th>
                  <th className="py-2.5 px-4 text-right">NTU Baseline (μ)</th>
                  <th className="py-2.5 px-4 text-right">NTU Z-Score</th>
                  <th className="py-2.5 px-4">Classification</th>
                  <th className="py-2.5 px-4">Pattern Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {state.statisticalSignals.map((sig) => (
                  <tr key={sig.stationId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <span className="font-mono text-sky-700 mr-1.5">{sig.stationId}</span>
                      {sig.stationName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {sig.phBaselineMean.toFixed(2)} ±{sig.phBaselineStd.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        Math.abs(sig.phZScore) >= 2.4 ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {sig.phZScore >= 0 ? '+' : ''}
                      {sig.phZScore.toFixed(2)}σ
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {sig.turbidityBaselineMean.toFixed(2)} ±{sig.turbidityBaselineStd.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        Math.abs(sig.turbidityZScore) >= 2.4 ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {sig.turbidityZScore >= 0 ? '+' : ''}
                      {sig.turbidityZScore.toFixed(2)}σ
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      {sig.isStatisticalAnomaly ? (
                        sig.withinRuleThresholds ? (
                          <span className="text-sky-700">▲ AI Sub-Threshold Drift</span>
                        ) : (
                          <span className="text-red-700">■ Rule + Pattern Deviation</span>
                        )
                      ) : (
                        <span className="text-emerald-700">● Within Baseline</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">{sig.patternSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Latest Gemini AI Analysis Report */}
      {latestReport ? (
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="text-xs font-mono text-slate-500">
                AI REPORT {latestReport.id} ·{' '}
                {latestReport.mode === 'demo' ? 'DEMO DATA' : 'LIVE TELEMETRY'} ·{' '}
                {formatTimestamp(latestReport.createdAt)}
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-1">
                AI Anomaly Explanation & Baseline Synthesis
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Scope: {latestReport.targetStationId === 'all' ? 'All Stations' : latestReport.targetStationId}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-900">Network Assessment</div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {latestReport.networkAssessment}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-900">
                Rule Alerts vs. AI Pattern Predictions
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {latestReport.ruleVsAiDistinction}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {latestReport.findings.map((f) => (
              <div
                key={f.stationId}
                className="border border-slate-200 rounded-md p-4 space-y-3 bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-sky-700 font-semibold">
                      {f.stationId} · {f.distinctionType}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{f.confidenceNote}</div>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      f.severity === 'elevated'
                        ? 'text-red-700'
                        : f.severity === 'moderate'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {f.anomalyDetected ? `▲ ${f.severity.toUpperCase()} ANOMALY` : '● EXPECTED'}
                  </span>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed">{f.summary}</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-700">Baseline Comparison: </span>
                  {f.comparisonWithBaseline}
                </p>

                {f.possibleDisturbanceFactors.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Possible Disturbance Factors: </span>
                    {f.possibleDisturbanceFactors.join('; ')}
                  </div>
                )}

                {f.recommendedActions.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-sky-600" />
                      Recommended Actions
                    </div>
                    {f.recommendedActions.map((act, idx) => (
                      <div key={idx}>• {act}</div>
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-slate-500 italic">{f.limitationsNote}</div>
              </div>
            ))}
          </div>

          <div className="bg-sky-50/70 border border-sky-200 rounded-md p-3 text-xs text-sky-950">
            <span className="font-semibold">Calibration & Laboratory Verification: </span>
            {latestReport.verificationReminder}
          </div>
        </section>
      ) : (
        <section className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center space-y-2">
          <BrainCircuit className="w-6 h-6 text-sky-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900">No AI Anomaly Report Generated Yet</h3>
          <p className="text-xs text-slate-600 max-w-lg mx-auto">
            Click <span className="font-semibold">Analyze Telemetry with AI</span> above to run
            server-side pattern synthesis over recent pH, turbidity, and rolling baseline data.
          </p>
        </section>
      )}
    </div>
  );
};
