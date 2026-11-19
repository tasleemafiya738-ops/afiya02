import React, { useMemo, useState } from 'react';
import type { SensorReading, ThresholdSettings } from '../types/water';
import { formatShortDate, formatShortTime, formatTimestamp } from '../utils/formatters';

interface TrendLineChartProps {
  title: string;
  unit: string;
  metric: 'ph' | 'turbidity';
  readings: SensorReading[];
  settings: ThresholdSettings;
  height?: number;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  title,
  unit,
  metric,
  readings,
  settings,
  height = 240,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...readings].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [readings]
  );

  const width = 760;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { minY, maxY, yTicks } = useMemo(() => {
    if (metric === 'ph') {
      const vals = sorted.map((r) => r.ph);
      const rawMin = vals.length ? Math.min(...vals, settings.phMin - 0.3) : 5.8;
      const rawMax = vals.length ? Math.max(...vals, settings.phMax + 0.3) : 9.0;
      const min = Math.floor(rawMin * 2) / 2;
      const max = Math.ceil(rawMax * 2) / 2;
      const step = (max - min) / 4;
      return {
        minY: min,
        maxY: max,
        yTicks: [min, min + step, min + step * 2, min + step * 3, max],
      };
    } else {
      const vals = sorted.map((r) => r.turbidity);
      const rawMax = vals.length
        ? Math.max(...vals, settings.turbidityCritical * 1.05, 2.0)
        : 5.0;
      const max = Math.ceil(rawMax);
      const min = 0;
      const step = max / 4;
      return {
        minY: min,
        maxY: max,
        yTicks: [0, step, step * 2, step * 3, max],
      };
    }
  }, [metric, sorted, settings]);

  const toX = (idx: number) => {
    if (sorted.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (sorted.length - 1)) * plotW;
  };

  const toY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    const ratio = (clamped - minY) / (maxY - minY || 1);
    return padTop + plotH - ratio * plotH;
  };

  const linePath = useMemo(() => {
    if (sorted.length === 0) return '';
    return sorted
      .map((r, i) => {
        const val = metric === 'ph' ? r.ph : r.turbidity;
        return `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(val).toFixed(1)}`;
      })
      .join(' ');
  }, [sorted, metric, minY, maxY]);

  const areaPath = useMemo(() => {
    if (sorted.length < 2) return '';
    const lastX = toX(sorted.length - 1).toFixed(1);
    const firstX = toX(0).toFixed(1);
    const baseY = (padTop + plotH).toFixed(1);
    return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [linePath, sorted.length, plotH]);

  const activeReading = hoverIdx !== null && sorted[hoverIdx] ? sorted[hoverIdx] : null;
  const lineColor = metric === 'ph' ? '#0284C7' : '#0891B2';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {metric === 'ph'
              ? `Configured operational range: ${settings.phMin.toFixed(1)}–${settings.phMax.toFixed(1)} pH`
              : `Operational target ≤ ${settings.turbidityTarget.toFixed(1)} NTU · Warning > ${settings.turbidityWarning.toFixed(1)} NTU · Critical ≥ ${settings.turbidityCritical.toFixed(1)} NTU`}
          </p>
        </div>

        {activeReading ? (
          <div className="text-xs font-mono tabular-nums text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
            <span>{activeReading.stationId}</span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span className="font-semibold text-slate-900">
              {metric === 'ph'
                ? `${activeReading.ph.toFixed(2)} pH`
                : `${activeReading.turbidity.toFixed(2)} NTU`}
            </span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span className="text-slate-500">{formatTimestamp(activeReading.timestamp)}</span>
          </div>
        ) : (
          <div className="text-xs font-mono tabular-nums text-slate-500">
            {sorted.length} samples plotted
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div
          style={{ height }}
          className="flex items-center justify-center border border-dashed border-slate-200 rounded bg-slate-50/60 text-xs text-slate-500"
        >
          No telemetry points available for this selection yet.
        </div>
      ) : (
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair select-none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.16" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Safe Operational Band */}
            {metric === 'ph' ? (
              <rect
                x={padLeft}
                y={toY(settings.phMax)}
                width={plotW}
                height={Math.max(0, toY(settings.phMin) - toY(settings.phMax))}
                fill="#10B981"
                fillOpacity="0.07"
              />
            ) : (
              <rect
                x={padLeft}
                y={toY(settings.turbidityWarning)}
                width={plotW}
                height={Math.max(0, toY(0) - toY(settings.turbidityWarning))}
                fill="#10B981"
                fillOpacity="0.07"
              />
            )}

            {/* Gridlines and Y Labels */}
            {yTicks.map((tick, i) => {
              const y = toY(tick);
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotW}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 text-[10px] font-mono tabular-nums"
                  >
                    {tick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Threshold Reference Lines */}
            {metric === 'ph' ? (
              <>
                <line
                  x1={padLeft}
                  y1={toY(settings.phMax)}
                  x2={padLeft + plotW}
                  y2={toY(settings.phMax)}
                  stroke="#D97706"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <line
                  x1={padLeft}
                  y1={toY(settings.phMin)}
                  x2={padLeft + plotW}
                  y2={toY(settings.phMin)}
                  stroke="#D97706"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              </>
            ) : (
              <>
                <line
                  x1={padLeft}
                  y1={toY(settings.turbidityWarning)}
                  x2={padLeft + plotW}
                  y2={toY(settings.turbidityWarning)}
                  stroke="#D97706"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                {settings.turbidityCritical <= maxY && (
                  <line
                    x1={padLeft}
                    y1={toY(settings.turbidityCritical)}
                    x2={padLeft + plotW}
                    y2={toY(settings.turbidityCritical)}
                    stroke="#DC2626"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}
              </>
            )}

            {/* Area & Curve */}
            {areaPath && <path d={areaPath} fill={`url(#grad-${metric})`} />}
            <path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Anomaly / Out-of-limit point highlights */}
            {sorted.map((r, i) => {
              if (r.qualityStatus === 'normal') return null;
              const val = metric === 'ph' ? r.ph : r.turbidity;
              const fill = r.qualityStatus === 'critical' ? '#DC2626' : '#D97706';
              return (
                <circle
                  key={r.id}
                  cx={toX(i)}
                  cy={toY(val)}
                  r="3.2"
                  fill={fill}
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
              );
            })}

            {/* X-axis sample timestamps */}
            {[0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]
              .filter((v, idx, arr) => v >= 0 && arr.indexOf(v) === idx)
              .map((idx) => (
                <text
                  key={idx}
                  x={toX(idx)}
                  y={height - 8}
                  textAnchor={idx === 0 ? 'start' : idx === sorted.length - 1 ? 'end' : 'middle'}
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {formatShortDate(sorted[idx].timestamp)} {formatShortTime(sorted[idx].timestamp)}
                </text>
              ))}

            {/* Unit Label */}
            <text
              x={8}
              y={padTop + 4}
              className="fill-slate-400 text-[10px] font-mono uppercase"
            >
              {unit}
            </text>

            {/* Crosshair */}
            {hoverIdx !== null && sorted[hoverIdx] && (
              <g pointerEvents="none">
                <line
                  x1={toX(hoverIdx)}
                  y1={padTop}
                  x2={toX(hoverIdx)}
                  y2={padTop + plotH}
                  stroke="#0F172A"
                  strokeOpacity="0.28"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={toX(hoverIdx)}
                  cy={toY(metric === 'ph' ? sorted[hoverIdx].ph : sorted[hoverIdx].turbidity)}
                  r="4.5"
                  fill={lineColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Invisible hover hit targets */}
            {sorted.map((r, i) => {
              const sliceW = plotW / Math.max(1, sorted.length);
              return (
                <rect
                  key={r.id}
                  x={Math.max(padLeft, toX(i) - sliceW / 2)}
                  y={padTop}
                  width={Math.max(6, sliceW)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

interface StationComparisonItem {
  stationId: string;
  stationName: string;
  dailyMean: number;
  weeklyMean: number;
}

export const DailyWeeklyComparisonChart: React.FC<{
  title: string;
  unit: string;
  items: StationComparisonItem[];
  referenceLine?: number;
}> = ({ title, unit, items, referenceLine }) => {
  const width = 760;
  const height = 220;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = useMemo(() => {
    const vals = items.flatMap((i) => [i.dailyMean, i.weeklyMean]);
    if (referenceLine !== undefined) vals.push(referenceLine);
    const max = vals.length ? Math.max(...vals) : 1;
    return Math.max(1, Math.ceil(max * 1.15 * 10) / 10);
  }, [items, referenceLine]);

  const toY = (v: number) => padTop + plotH - (v / (maxVal || 1)) * plotH;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            24-hour station average compared against 7-day rolling mean ({unit})
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-600 rounded-xs inline-block" />
            Last 24h Mean
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-slate-300 rounded-xs inline-block" />
            7-Day Baseline
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center border border-dashed border-slate-200 rounded text-xs text-slate-500">
          Insufficient readings for daily vs. weekly comparison.
        </div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const val = maxVal * ratio;
            const y = toY(val);
            return (
              <g key={idx}>
                <line x1={padLeft} y1={y} x2={padLeft + plotW} y2={y} stroke="#E2E8F0" />
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {referenceLine !== undefined && referenceLine <= maxVal && (
            <line
              x1={padLeft}
              y1={toY(referenceLine)}
              x2={padLeft + plotW}
              y2={toY(referenceLine)}
              stroke="#D97706"
              strokeDasharray="4 3"
              strokeWidth="1"
            />
          )}

          {items.map((item, idx) => {
            const groupW = plotW / items.length;
            const centerX = padLeft + groupW * idx + groupW / 2;
            const barW = Math.min(24, groupW * 0.26);

            const yDaily = toY(item.dailyMean);
            const yWeekly = toY(item.weeklyMean);
            const hDaily = Math.max(2, padTop + plotH - yDaily);
            const hWeekly = Math.max(2, padTop + plotH - yWeekly);

            return (
              <g key={item.stationId}>
                <rect
                  x={centerX - barW - 2}
                  y={yDaily}
                  width={barW}
                  height={hDaily}
                  rx="2"
                  fill="#0284C7"
                />
                <rect
                  x={centerX + 2}
                  y={yWeekly}
                  width={barW}
                  height={hWeekly}
                  rx="2"
                  fill="#CBD5E1"
                />
                <text
                  x={centerX}
                  y={height - 16}
                  textAnchor="middle"
                  className="fill-slate-700 text-[11px] font-mono font-medium"
                >
                  {item.stationId}
                </text>
                <text
                  x={centerX}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-slate-400 text-[9px] font-mono tabular-nums"
                >
                  {item.dailyMean.toFixed(2)} / {item.weeklyMean.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};
