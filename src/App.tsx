import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  Droplets,
  FileSpreadsheet,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { AiAnomalySection } from './components/AiAnomalySection';
import { AlertsSection } from './components/AlertsSection';
import { AnalyticsSection } from './components/AnalyticsSection';
import { LiveMonitoringSection } from './components/LiveMonitoringSection';
import { OverviewSection } from './components/OverviewSection';
import { PipelineMapView } from './components/PipelineMapView';
import { ReportsSection } from './components/ReportsSection';
import { SettingsSection } from './components/SettingsSection';
import type {
  DashboardState,
  DemoScenario,
  NavSection,
  SystemMode,
  ThresholdSettings,
} from './types/water';
import { formatTimestamp } from './utils/formatters';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live', label: 'Live Monitoring', icon: Activity },
  { id: 'analytics', label: 'Water Quality Analytics', icon: BarChart3 },
  { id: 'anomaly', label: 'AI Anomaly Detection', icon: BrainCircuit },
  { id: 'map', label: 'Pipeline Map', icon: MapIcon },
  { id: 'alerts', label: 'Alerts & Notifications', icon: Bell },
  { id: 'reports', label: 'Historical Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchInitial() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = (await res.json()) as DashboardState;
        if (active) {
          setState(data);
          setLoadError(null);
        }
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Unable to connect to telemetry API.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchInitial();

    // Real-time SSE connection for instant telemetry updates
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (evt) => {
      try {
        const next = JSON.parse(evt.data) as DashboardState;
        if (active) setState(next);
      } catch {
        // Ignore malformed SSE keepalive frames
      }
    };

    return () => {
      active = false;
      eventSource.close();
    };
  }, []);

  const handleSwitchMode = async (mode: SystemMode) => {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      setState(await res.json());
    }
  };

  const handleSelectScenario = async (scenario: DemoScenario) => {
    const res = await fetch('/api/demo/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (res.ok) {
      setState(await res.json());
    }
  };

  const handleTickDemo = async () => {
    const res = await fetch('/api/demo/tick', { method: 'POST' });
    if (res.ok) {
      setState(await res.json());
    }
  };

  const handleIngestReading = async (payload: {
    stationId: string;
    ph: number;
    turbidity: number;
    temperature: number | null;
    pipelineLocation: string;
  }) => {
    const res = await fetch('/api/sensors/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, source: 'manual_entry' }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to ingest telemetry.');
    }
    setState(data.state);
  };

  const handleUpdateSettings = async (partial: Partial<ThresholdSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save settings.');
    }
    setState(data);
  };

  const handleAddStation = async (station: {
    id: string;
    name: string;
    pipelineSegment: string;
    zone: string;
    sensorModel: string;
  }) => {
    const res = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(station),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add station.');
    setState(data.state);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setState(data.state);
    }
  };

  const handleResolveAlert = async (id: string) => {
    const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setState(data.state);
    }
  };

  const handleRunAiAnalysis = async (stationId?: string) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: stationId || 'all' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI analysis failed.');
      }
      setState(data.state);
      setActiveSection('anomaly');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to run AI anomaly analysis.');
      setActiveSection('anomaly');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 w-full max-w-md space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded w-3/4 animate-pulse" />
          <div className="h-24 bg-slate-100 rounded w-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md space-y-3">
          <h1 className="text-base font-semibold text-red-700">Telemetry Server Unavailable</h1>
          <p className="text-xs text-slate-600">{loadError || 'Unknown connection error.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const openAlertsCount = state.alerts.filter((a) => !a.resolved).length;
  const activeNavItem = NAV_ITEMS.find((n) => n.id === activeSection)!;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Droplets className="w-4 h-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            AquaGuard AI
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Dashboard sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-sky-50 text-sky-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'alerts' && openAlertsCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold text-amber-700 ml-2">
                    {openAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">
            {state.mode === 'demo' ? 'Mode: Demo Simulation' : 'Mode: Live Sensor API'}
          </div>
          <div className="font-mono tabular-nums">
            Updated {formatTimestamp(state.lastUpdated)}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-sky-600 text-white flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <span className="font-display text-sm font-bold text-slate-900">AquaGuard AI</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-md cursor-pointer ${
                      active
                        ? 'bg-sky-50 text-sky-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'alerts' && openAlertsCount > 0 && (
                      <span className="font-mono text-amber-700 font-semibold">
                        {openAlertsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Single-Row Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">AquaGuard AI</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{activeNavItem.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveSection('alerts')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Alerts ({openAlertsCount})
            </button>
            <button
              onClick={() =>
                (window.location.href = '/api/reports/csv?stationId=all')
              }
              className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </header>

        {/* Workspace Mode Toolbar (below header, handles Demo vs Live separation clearly) */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            {state.mode === 'demo' ? (
              <span className="text-sky-900 font-medium flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                <span>
                  <strong className="font-mono">DEMO DATA:</strong> Displaying simulated
                  municipal distribution telemetry. No physical sensor hardware is connected.
                </span>
              </span>
            ) : (
              <span className="text-slate-700 font-medium">
                <strong className="font-mono text-emerald-700">LIVE SENSOR MODE:</strong>{' '}
                Showing real telemetry received via{' '}
                <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">
                  /api/sensors/ingest
                </code>
                . Unreported stations remain marked Disconnected.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md shrink-0">
            <button
              onClick={() => handleSwitchMode('demo')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                state.mode === 'demo'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Demo Mode
            </button>
            <button
              onClick={() => handleSwitchMode('live')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                state.mode === 'live'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Sensor Mode
            </button>
          </div>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewSection
              state={state}
              onNavigate={setActiveSection}
              onRunAiAnalysis={() => handleRunAiAnalysis('all')}
              aiLoading={aiLoading}
            />
          )}

          {activeSection === 'live' && (
            <LiveMonitoringSection
              state={state}
              onSelectScenario={handleSelectScenario}
              onTickDemo={handleTickDemo}
              onIngestReading={handleIngestReading}
            />
          )}

          {activeSection === 'analytics' && <AnalyticsSection state={state} />}

          {activeSection === 'anomaly' && (
            <AiAnomalySection
              state={state}
              onRunAiAnalysis={handleRunAiAnalysis}
              aiLoading={aiLoading}
              aiError={aiError}
            />
          )}

          {activeSection === 'map' && (
            <PipelineMapView
              mode={state.mode}
              stations={state.stations}
              alerts={state.alerts}
              settings={state.settings}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsSection
              state={state}
              onAcknowledge={handleAcknowledgeAlert}
              onResolve={handleResolveAlert}
            />
          )}

          {activeSection === 'reports' && <ReportsSection state={state} />}

          {activeSection === 'settings' && (
            <SettingsSection
              state={state}
              onUpdateSettings={handleUpdateSettings}
              onSwitchMode={handleSwitchMode}
              onAddStation={handleAddStation}
            />
          )}
        </main>
      </div>
    </div>
  );
}
