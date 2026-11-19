import fs from 'fs';
import path from 'path';
import type {
  AiAnalysisReport,
  AlertSeverity,
  ConnectionStatus,
  DashboardState,
  DemoScenario,
  MonitoringStation,
  QualityStatus,
  SensorReading,
  StatisticalSignal,
  SystemMode,
  ThresholdSettings,
  WaterAlert,
} from '../src/types/water.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'aquaguard-store.json');

const DEFAULT_SETTINGS: ThresholdSettings = {
  phMin: 6.5,
  phMax: 8.5,
  turbidityTarget: 1.0,
  turbidityWarning: 1.0,
  turbidityCritical: 4.0,
  phSuddenDelta: 0.45,
  turbiditySuddenDelta: 0.75,
  sensorTimeoutSeconds: 90,
};

interface StationSeed {
  id: string;
  name: string;
  pipelineSegment: string;
  zone: string;
  coordinates: { x: number; y: number; lat: number; lng: number };
  sensorModel: string;
  basePh: number;
  baseTurbidity: number;
  baseTemp: number;
}

const STATION_SEEDS: StationSeed[] = [
  {
    id: 'ST-101',
    name: 'North Reservoir Intake',
    pipelineSegment: 'Main Trunk North (DN600)',
    zone: 'Zone A · Intake & Filtration Outlet',
    coordinates: { x: 130, y: 120, lat: 37.8044, lng: -122.2712 },
    sensorModel: 'ESP32-S3 + pH-4502C / SEN0189',
    basePh: 7.32,
    baseTurbidity: 0.42,
    baseTemp: 15.8,
  },
  {
    id: 'ST-102',
    name: 'Central Booster Hub',
    pipelineSegment: 'Primary Transmission Line B',
    zone: 'Zone B · Central Pumping Station',
    coordinates: { x: 390, y: 210, lat: 37.7989, lng: -122.2564 },
    sensorModel: 'ESP32-S3 + Atlas pH / Optical NTU',
    basePh: 7.24,
    baseTurbidity: 0.54,
    baseTemp: 16.4,
  },
  {
    id: 'ST-103',
    name: 'East Industrial Loop',
    pipelineSegment: 'East Lateral Header (DN300)',
    zone: 'Zone C · Commercial Corridor',
    coordinates: { x: 740, y: 145, lat: 37.7955, lng: -122.2389 },
    sensorModel: 'ESP32-S3 + pH-4502C / SEN0189',
    basePh: 7.45,
    baseTurbidity: 0.68,
    baseTemp: 17.2,
  },
  {
    id: 'ST-104',
    name: 'Oakridge Distribution Node',
    pipelineSegment: 'Midtown Sub-Main (DN250)',
    zone: 'Zone D · Mixed Residential',
    coordinates: { x: 520, y: 345, lat: 37.7852, lng: -122.2498 },
    sensorModel: 'ESP32-S3 + pH-4502C / SEN0189',
    basePh: 7.18,
    baseTurbidity: 0.61,
    baseTemp: 16.9,
  },
  {
    id: 'ST-105',
    name: 'South Residential Terminal',
    pipelineSegment: 'South End-of-Line (DN200)',
    zone: 'Zone E · Terminal Storage Tank',
    coordinates: { x: 825, y: 380, lat: 37.7749, lng: -122.2315 },
    sensorModel: 'ESP32-S3 + Atlas pH / Optical NTU',
    basePh: 7.38,
    baseTurbidity: 0.74,
    baseTemp: 17.6,
  },
  {
    id: 'ST-106',
    name: 'West Hilltop Valve Chamber',
    pipelineSegment: 'West Pressure Zone (DN250)',
    zone: 'Zone F · Elevated Service Area',
    coordinates: { x: 185, y: 390, lat: 37.7811, lng: -122.2814 },
    sensorModel: 'ESP32-S3 + pH-4502C / SEN0189',
    basePh: 7.29,
    baseTurbidity: 0.49,
    baseTemp: 16.1,
  },
];

interface PersistedData {
  mode: SystemMode;
  activeDemoScenario: DemoScenario;
  settings: ThresholdSettings;
  stations: MonitoringStation[];
  demoReadings: SensorReading[];
  liveReadings: SensorReading[];
  demoAlerts: WaterAlert[];
  liveAlerts: WaterAlert[];
  aiReports: AiAnalysisReport[];
  lastUpdated: string;
}

function round(num: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function evaluateReadingStatus(
  ph: number,
  turbidity: number,
  deltaPh: number,
  deltaTurbidity: number,
  settings: ThresholdSettings
): QualityStatus {
  const phCritical = ph < settings.phMin - 0.5 || ph > settings.phMax + 0.5;
  const phWarning = ph < settings.phMin || ph > settings.phMax;
  const turbCritical = turbidity >= settings.turbidityCritical;
  const turbWarning = turbidity > settings.turbidityWarning;
  const suddenCritical =
    Math.abs(deltaPh) >= settings.phSuddenDelta * 1.6 ||
    Math.abs(deltaTurbidity) >= settings.turbiditySuddenDelta * 1.8;
  const suddenWarning =
    Math.abs(deltaPh) >= settings.phSuddenDelta ||
    Math.abs(deltaTurbidity) >= settings.turbiditySuddenDelta;

  if (phCritical || turbCritical || suddenCritical) return 'critical';
  if (phWarning || turbWarning || suddenWarning) return 'warning';
  return 'normal';
}

function buildInitialDemoHistory(settings: ThresholdSettings): {
  readings: SensorReading[];
  alerts: WaterAlert[];
} {
  const now = Date.now();
  const readings: SensorReading[] = [];
  const alerts: WaterAlert[] = [];

  // Generate 7 days of hourly readings across all 6 demo stations (168 pts per station -> compact 48 pts over 7 days + recent 12 pts)
  // Using 36 evenly spaced points across 7 days + 12 recent 5-min points = 48 points per station (288 total)
  const offsetsMinutes: number[] = [];
  for (let i = 36; i >= 1; i--) {
    offsetsMinutes.push(i * 280); // ~7 days back
  }
  for (let i = 12; i >= 0; i--) {
    offsetsMinutes.push(i * 4); // recent ~48 minutes
  }

  for (const seed of STATION_SEEDS) {
    let prevPh = seed.basePh;
    let prevTurb = seed.baseTurbidity;

    for (let idx = 0; idx < offsetsMinutes.length; idx++) {
      const ts = new Date(now - offsetsMinutes[idx] * 60_000).toISOString();
      const wave = Math.sin(idx * 0.45 + seed.basePh * 2);
      const jitterPh = (Math.random() - 0.5) * 0.08;
      const jitterTurb = (Math.random() - 0.5) * 0.09;

      let ph = round(seed.basePh + wave * 0.09 + jitterPh, 2);
      let turbidity = round(Math.max(0.18, seed.baseTurbidity + Math.cos(idx * 0.35) * 0.08 + jitterTurb), 2);
      const temp = round(seed.baseTemp + Math.sin(idx * 0.2) * 0.6, 1);

      // Inject 1 realistic historical disturbance on ST-103 ~18 hours ago and 1 minor turbidity elevation on ST-105 recently
      if (seed.id === 'ST-103' && idx === 31) {
        turbidity = 1.65;
        ph = 7.52;
      }
      if (seed.id === 'ST-105' && idx === offsetsMinutes.length - 1) {
        turbidity = 1.28; // slightly above 1.0 NTU target to show realistic active warning in Demo Mode
      }

      const deltaPh = idx === 0 ? 0 : round(ph - prevPh, 2);
      const deltaTurb = idx === 0 ? 0 : round(turbidity - prevTurb, 2);
      const qualityStatus = evaluateReadingStatus(ph, turbidity, deltaPh, deltaTurb, settings);

      readings.push({
        id: `rd-${seed.id}-${idx}`,
        stationId: seed.id,
        pipelineLocation: seed.pipelineSegment,
        ph,
        turbidity,
        temperature: temp,
        timestamp: ts,
        isDemo: true,
        source: 'demo_simulator',
        qualityStatus,
        deltaPh,
        deltaTurbidity: deltaTurb,
      });

      if (idx === offsetsMinutes.length - 1 && qualityStatus !== 'normal') {
        alerts.push({
          id: `alt-init-${seed.id}`,
          stationId: seed.id,
          pipelineLocation: seed.pipelineSegment,
          alertType: 'Turbidity Above Preferred Limit',
          category: 'rule_threshold',
          severity: 'warning',
          detectedValue: `${turbidity.toFixed(2)} NTU`,
          thresholdReference: `Preferred target ≤ ${settings.turbidityWarning.toFixed(1)} NTU`,
          timestamp: ts,
          recommendedAction:
            'Inspect downstream filtration and check for localized sediment disturbance or pressure transient; collect a confirmatory grab sample.',
          explanation: `Demo turbidity reading (${turbidity.toFixed(2)} NTU) exceeded the configured ${settings.turbidityWarning.toFixed(1)} NTU warning threshold at ${seed.name}.`,
          isDemo: true,
          acknowledged: false,
          resolved: false,
        });
      }

      prevPh = ph;
      prevTurb = turbidity;
    }
  }

  // Sort chronological ascending
  readings.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { readings, alerts };
}

class WaterQualityStore {
  private data: PersistedData;

  constructor() {
    this.data = this.loadOrInitialize();
  }

  private loadOrInitialize(): PersistedData {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedData;
        if (parsed && Array.isArray(parsed.stations) && parsed.settings) {
          return parsed;
        }
      }
    } catch {
      // Fallback to clean initialization
    }

    const settings = { ...DEFAULT_SETTINGS };
    const { readings, alerts } = buildInitialDemoHistory(settings);
    const nowIso = new Date().toISOString();

    const stations: MonitoringStation[] = STATION_SEEDS.map((seed) => {
      const stationReadings = readings.filter((r) => r.stationId === seed.id);
      const latest = stationReadings[stationReadings.length - 1] ?? null;
      return {
        id: seed.id,
        name: seed.name,
        pipelineSegment: seed.pipelineSegment,
        zone: seed.zone,
        coordinates: seed.coordinates,
        sensorModel: seed.sensorModel,
        isDemoStation: true,
        lastCalibration: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString().slice(0, 10),
        connectionStatus: 'demo_active',
        qualityStatus: latest ? latest.qualityStatus : 'normal',
        lastSeenAt: latest ? latest.timestamp : nowIso,
        latestReading: latest,
      };
    });

    const initial: PersistedData = {
      mode: 'demo',
      activeDemoScenario: 'normal',
      settings,
      stations,
      demoReadings: readings,
      liveReadings: [],
      demoAlerts: alerts,
      liveAlerts: [],
      aiReports: [],
      lastUpdated: nowIso,
    };

    this.persistData(initial);
    return initial;
  }

  private persist(): void {
    this.persistData(this.data);
  }

  private persistData(data: PersistedData): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  private getReadingsForMode(mode = this.data.mode): SensorReading[] {
    return mode === 'demo' ? this.data.demoReadings : this.data.liveReadings;
  }

  private getAlertsForMode(mode = this.data.mode): WaterAlert[] {
    return mode === 'demo' ? this.data.demoAlerts : this.data.liveAlerts;
  }

  public refreshStationStatuses(): void {
    const now = Date.now();
    const timeoutMs = this.data.settings.sensorTimeoutSeconds * 1000;
    const isDemo = this.data.mode === 'demo';
    const readings = this.getReadingsForMode();
    const alerts = this.getAlertsForMode();

    this.data.stations = this.data.stations.map((station) => {
      const stationReadings = readings.filter((r) => r.stationId === station.id);
      const latest = stationReadings[stationReadings.length - 1] ?? null;

      if (isDemo) {
        const isDropped =
          this.data.activeDemoScenario === 'sensor_dropout' && station.id === 'ST-103';
        const conn: ConnectionStatus = isDropped ? 'disconnected' : 'demo_active';
        const qStatus: QualityStatus = isDropped
          ? 'disconnected'
          : latest
            ? latest.qualityStatus
            : 'normal';

        return {
          ...station,
          connectionStatus: conn,
          qualityStatus: qStatus,
          lastSeenAt: latest ? latest.timestamp : null,
          latestReading: latest,
        };
      }

      // Live Sensor Mode: NEVER fabricate live connection! Check real lastSeenAt from liveReadings.
      if (!latest) {
        return {
          ...station,
          connectionStatus: 'disconnected',
          qualityStatus: 'disconnected',
          lastSeenAt: null,
          latestReading: null,
        };
      }

      const ageMs = now - new Date(latest.timestamp).getTime();
      const connected = ageMs <= timeoutMs;
      const conn: ConnectionStatus = connected ? 'connected' : 'disconnected';
      const qStatus: QualityStatus = connected ? latest.qualityStatus : 'disconnected';

      // Generate connectivity alert if disconnected and no unresolved connectivity alert exists
      if (!connected) {
        const hasOpenConnAlert = alerts.some(
          (a) =>
            a.stationId === station.id &&
            a.category === 'sensor_connectivity' &&
            !a.resolved
        );
        if (!hasOpenConnAlert) {
          alerts.unshift({
            id: uid('alt'),
            stationId: station.id,
            pipelineLocation: station.pipelineSegment,
            alertType: 'Sensor Connectivity Lost',
            category: 'sensor_connectivity',
            severity: 'critical',
            detectedValue: `Offline (${Math.round(ageMs / 1000)}s since last packet)`,
            thresholdReference: `Timeout limit ${this.data.settings.sensorTimeoutSeconds}s`,
            timestamp: new Date().toISOString(),
            recommendedAction:
              'Check ESP32/IoT node power supply, LoRa/Wi-Fi telemetry gateway, and sensor wiring.',
            explanation: `No telemetry packet received from ${station.id} within the configured ${this.data.settings.sensorTimeoutSeconds}s window.`,
            isDemo: false,
            acknowledged: false,
            resolved: false,
          });
        }
      }

      return {
        ...station,
        connectionStatus: conn,
        qualityStatus: qStatus,
        lastSeenAt: latest.timestamp,
        latestReading: latest,
      };
    });
  }

  public computeStatisticalSignals(): StatisticalSignal[] {
    const isDemo = this.data.mode === 'demo';
    const readings = this.getReadingsForMode();
    const settings = this.data.settings;
    const signals: StatisticalSignal[] = [];

    for (const station of this.data.stations) {
      const stationReadings = readings.filter((r) => r.stationId === station.id);
      if (stationReadings.length < 3) continue;

      const latest = stationReadings[stationReadings.length - 1];
      const baseline = stationReadings.slice(-30, -1);
      if (baseline.length < 2) continue;

      const phMean = baseline.reduce((s, r) => s + r.ph, 0) / baseline.length;
      const turbMean = baseline.reduce((s, r) => s + r.turbidity, 0) / baseline.length;

      const phVar =
        baseline.reduce((s, r) => s + Math.pow(r.ph - phMean, 2), 0) / baseline.length;
      const turbVar =
        baseline.reduce((s, r) => s + Math.pow(r.turbidity - turbMean, 2), 0) / baseline.length;

      const phStd = Math.max(0.04, Math.sqrt(phVar));
      const turbStd = Math.max(0.05, Math.sqrt(turbVar));

      const phZ = round((latest.ph - phMean) / phStd, 2);
      const turbZ = round((latest.turbidity - turbMean) / turbStd, 2);

      const withinRule =
        latest.ph >= settings.phMin &&
        latest.ph <= settings.phMax &&
        latest.turbidity <= settings.turbidityWarning;

      const isStatAnomaly =
        Math.abs(phZ) >= 2.4 ||
        Math.abs(turbZ) >= 2.4 ||
        Math.abs(latest.deltaPh) >= settings.phSuddenDelta ||
        Math.abs(latest.deltaTurbidity) >= settings.turbiditySuddenDelta;

      let summary = 'Readings align with recent rolling station baseline.';
      if (isStatAnomaly && withinRule) {
        summary = `Sub-threshold drift detected: values remain within legal rule limits, but deviate significantly from this station's 30-point baseline (pH z=${phZ}, turbidity z=${turbZ}).`;
      } else if (isStatAnomaly) {
        summary = `Elevated statistical deviation coinciding with rule limit excursion (pH z=${phZ}, turbidity z=${turbZ}).`;
      }

      signals.push({
        stationId: station.id,
        stationName: station.name,
        phZScore: phZ,
        turbidityZScore: turbZ,
        phBaselineMean: round(phMean, 2),
        phBaselineStd: round(phStd, 3),
        turbidityBaselineMean: round(turbMean, 2),
        turbidityBaselineStd: round(turbStd, 3),
        rateOfChangePh: latest.deltaPh,
        rateOfChangeTurbidity: latest.deltaTurbidity,
        isStatisticalAnomaly: isStatAnomaly,
        withinRuleThresholds: withinRule,
        patternSummary: summary,
        timestamp: latest.timestamp,
        isDemo,
      });
    }

    return signals;
  }

  public getState(): DashboardState {
    this.refreshStationStatuses();
    const readings = this.getReadingsForMode();
    const alerts = this.getAlertsForMode();
    return {
      mode: this.data.mode,
      activeDemoScenario: this.data.activeDemoScenario,
      settings: this.data.settings,
      stations: this.data.stations,
      readings: readings.slice(-360),
      alerts: alerts.slice(0, 100),
      statisticalSignals: this.computeStatisticalSignals(),
      aiReports: this.data.aiReports.filter((r) => r.mode === this.data.mode).slice(0, 12),
      lastUpdated: this.data.lastUpdated,
    };
  }

  public setMode(mode: SystemMode): DashboardState {
    this.data.mode = mode;
    this.data.lastUpdated = new Date().toISOString();
    this.refreshStationStatuses();
    this.persist();
    return this.getState();
  }

  public setDemoScenario(scenario: DemoScenario): DashboardState {
    this.data.activeDemoScenario = scenario;
    if (this.data.mode !== 'demo') {
      this.data.mode = 'demo';
    }
    this.tickDemoData(scenario);
    return this.getState();
  }

  public updateSettings(partial: Partial<ThresholdSettings>): DashboardState {
    this.data.settings = {
      ...this.data.settings,
      ...partial,
    };
    this.data.lastUpdated = new Date().toISOString();
    this.persist();
    return this.getState();
  }

  public addStation(input: {
    id: string;
    name: string;
    pipelineSegment: string;
    zone: string;
    sensorModel: string;
    lat?: number;
    lng?: number;
  }): MonitoringStation {
    const cleanId = input.id.trim().toUpperCase();
    const existing = this.data.stations.find((s) => s.id === cleanId);
    if (existing) {
      existing.name = input.name;
      existing.pipelineSegment = input.pipelineSegment;
      existing.zone = input.zone;
      existing.sensorModel = input.sensorModel;
      this.persist();
      return existing;
    }

    const newStation: MonitoringStation = {
      id: cleanId,
      name: input.name,
      pipelineSegment: input.pipelineSegment,
      zone: input.zone,
      coordinates: {
        x: 300 + Math.round(Math.random() * 400),
        y: 150 + Math.round(Math.random() * 220),
        lat: input.lat ?? 37.785,
        lng: input.lng ?? -122.25,
      },
      sensorModel: input.sensorModel || 'ESP32-S3 + pH/Turbidity Node',
      isDemoStation: this.data.mode === 'demo',
      lastCalibration: new Date().toISOString().slice(0, 10),
      connectionStatus: this.data.mode === 'demo' ? 'demo_active' : 'disconnected',
      qualityStatus: this.data.mode === 'demo' ? 'normal' : 'disconnected',
      lastSeenAt: null,
      latestReading: null,
    };
    this.data.stations.push(newStation);
    this.data.lastUpdated = new Date().toISOString();
    this.persist();
    return newStation;
  }

  private evaluateAndCreateAlerts(
    reading: SensorReading,
    station: MonitoringStation,
    targetAlerts: WaterAlert[]
  ): WaterAlert[] {
    const s = this.data.settings;
    const created: WaterAlert[] = [];

    const pushAlert = (
      alertType: string,
      category: WaterAlert['category'],
      severity: AlertSeverity,
      detectedValue: string,
      thresholdReference: string,
      recommendedAction: string,
      explanation: string
    ) => {
      // Avoid flooding identical unresolved alerts within 2 minutes
      const recentDup = targetAlerts.find(
        (a) =>
          a.stationId === reading.stationId &&
          a.alertType === alertType &&
          !a.resolved &&
          Date.now() - new Date(a.timestamp).getTime() < 90_000
      );
      if (recentDup) return;

      const alert: WaterAlert = {
        id: uid('alt'),
        stationId: reading.stationId,
        pipelineLocation: station.pipelineSegment,
        alertType,
        category,
        severity,
        detectedValue,
        thresholdReference,
        timestamp: reading.timestamp,
        recommendedAction,
        explanation,
        isDemo: reading.isDemo,
        acknowledged: false,
        resolved: false,
      };
      targetAlerts.unshift(alert);
      created.push(alert);
    };

    // 1. pH Rule Check
    if (reading.ph < s.phMin || reading.ph > s.phMax) {
      const severe = reading.ph < s.phMin - 0.5 || reading.ph > s.phMax + 0.5;
      pushAlert(
        reading.ph < s.phMin ? 'Low pH (Acidic Excursion)' : 'High pH (Alkaline Excursion)',
        'rule_threshold',
        severe ? 'critical' : 'warning',
        `pH ${reading.ph.toFixed(2)}`,
        `Configured limit ${s.phMin.toFixed(1)}–${s.phMax.toFixed(1)} pH`,
        'Collect a confirmatory grab sample immediately, inspect dosing/pipeline integrity, and verify pH electrode calibration with pH 7.0/4.0 buffers.',
        `Measured pH of ${reading.ph.toFixed(2)} at ${station.name} moved outside the configured ${s.phMin.toFixed(1)}–${s.phMax.toFixed(1)} reference range.`
      );
    }

    // 2. Turbidity Rule Check
    if (reading.turbidity >= s.turbidityCritical) {
      pushAlert(
        'Critical Turbidity Exceedance',
        'rule_threshold',
        'critical',
        `${reading.turbidity.toFixed(2)} NTU`,
        `Critical limit ≥ ${s.turbidityCritical.toFixed(1)} NTU (Target ≤ ${s.turbidityTarget.toFixed(1)} NTU)`,
        'Inspect upstream filtration units, check for main breaks or heavy sediment disturbance, isolate affected segment if confirmed, and run laboratory verification.',
        `Turbidity reached ${reading.turbidity.toFixed(2)} NTU at ${station.name}, exceeding the critical ${s.turbidityCritical.toFixed(1)} NTU limit.`
      );
    } else if (reading.turbidity > s.turbidityWarning) {
      pushAlert(
        'Elevated Turbidity Warning',
        'rule_threshold',
        'warning',
        `${reading.turbidity.toFixed(2)} NTU`,
        `Warning limit > ${s.turbidityWarning.toFixed(1)} NTU (Target ≤ ${s.turbidityTarget.toFixed(1)} NTU)`,
        'Check filtration performance and monitor downstream stations for possible sediment disturbance or flow reversal.',
        `Turbidity reached ${reading.turbidity.toFixed(2)} NTU at ${station.name}, above the ${s.turbidityWarning.toFixed(1)} NTU preferred/warning limit.`
      );
    }

    // 3. Sudden Change Detection
    if (Math.abs(reading.deltaPh) >= s.phSuddenDelta) {
      pushAlert(
        'Sudden pH Shift Detected',
        'sudden_change',
        Math.abs(reading.deltaPh) >= s.phSuddenDelta * 1.5 ? 'critical' : 'warning',
        `Δ ${reading.deltaPh >= 0 ? '+' : ''}${reading.deltaPh.toFixed(2)} pH`,
        `Sudden delta limit ±${s.phSuddenDelta.toFixed(2)} pH/step`,
        'Inspect the pH sensor probe for air entrapment or fouling and collect a confirmatory manual water sample.',
        `Rapid step change of ${reading.deltaPh >= 0 ? '+' : ''}${reading.deltaPh.toFixed(2)} pH detected compared to the previous reading at ${station.name}.`
      );
    }

    if (Math.abs(reading.deltaTurbidity) >= s.turbiditySuddenDelta) {
      pushAlert(
        'Sudden Turbidity Surge Detected',
        'sudden_change',
        Math.abs(reading.deltaTurbidity) >= s.turbiditySuddenDelta * 1.6 ? 'critical' : 'warning',
        `Δ ${reading.deltaTurbidity >= 0 ? '+' : ''}${reading.deltaTurbidity.toFixed(2)} NTU`,
        `Sudden delta limit ±${s.turbiditySuddenDelta.toFixed(2)} NTU/step`,
        'Inspect the optical turbidity flow cell for trapped debris or air bubbles and collect a confirmatory sample.',
        `Abrupt change of ${reading.deltaTurbidity >= 0 ? '+' : ''}${reading.deltaTurbidity.toFixed(2)} NTU observed relative to the prior reading at ${station.name}.`
      );
    }

    return created;
  }

  public ingestReading(input: {
    stationId: string;
    ph: number;
    turbidity: number;
    temperature?: number | null;
    timestamp?: string;
    source?: 'iot_rest_api' | 'manual_entry';
    pipelineLocation?: string;
  }): { reading: SensorReading; alertsCreated: WaterAlert[] } {
    const cleanId = input.stationId.trim().toUpperCase();
    let station = this.data.stations.find((s) => s.id === cleanId);
    if (!station) {
      station = this.addStation({
        id: cleanId,
        name: `Field Node ${cleanId}`,
        pipelineSegment: input.pipelineLocation || `Pipeline Segment ${cleanId}`,
        zone: 'Live Field Telemetry',
        sensorModel: 'Connected IoT Water Node',
      });
    }

    const prevList = this.data.liveReadings.filter((r) => r.stationId === cleanId);
    const prev = prevList[prevList.length - 1];
    const deltaPh = prev ? round(input.ph - prev.ph, 2) : 0;
    const deltaTurbidity = prev ? round(input.turbidity - prev.turbidity, 2) : 0;

    const qualityStatus = evaluateReadingStatus(
      input.ph,
      input.turbidity,
      deltaPh,
      deltaTurbidity,
      this.data.settings
    );

    const reading: SensorReading = {
      id: uid('rd'),
      stationId: cleanId,
      pipelineLocation: input.pipelineLocation || station.pipelineSegment,
      ph: round(input.ph, 2),
      turbidity: round(Math.max(0, input.turbidity), 2),
      temperature:
        input.temperature !== undefined && input.temperature !== null
          ? round(input.temperature, 1)
          : null,
      timestamp: input.timestamp || new Date().toISOString(),
      isDemo: false,
      source: input.source || 'iot_rest_api',
      qualityStatus,
      deltaPh,
      deltaTurbidity,
    };

    this.data.liveReadings.push(reading);
    if (this.data.liveReadings.length > 2500) {
      this.data.liveReadings = this.data.liveReadings.slice(-2500);
    }

    // Resolve open connectivity alerts for this station when a live packet arrives
    this.data.liveAlerts = this.data.liveAlerts.map((a) =>
      a.stationId === cleanId && a.category === 'sensor_connectivity' && !a.resolved
        ? { ...a, resolved: true }
        : a
    );

    const alertsCreated = this.evaluateAndCreateAlerts(reading, station, this.data.liveAlerts);
    if (this.data.liveAlerts.length > 300) {
      this.data.liveAlerts = this.data.liveAlerts.slice(0, 300);
    }

    this.data.lastUpdated = reading.timestamp;
    this.refreshStationStatuses();
    this.persist();

    return { reading, alertsCreated };
  }

  public tickDemoData(overrideScenario?: DemoScenario): {
    newReadings: SensorReading[];
    alertsCreated: WaterAlert[];
  } {
    const scenario = overrideScenario ?? this.data.activeDemoScenario;
    const nowIso = new Date().toISOString();
    const newReadings: SensorReading[] = [];
    const alertsCreated: WaterAlert[] = [];

    for (const seed of STATION_SEEDS) {
      if (scenario === 'sensor_dropout' && seed.id === 'ST-103') {
        const hasConnAlert = this.data.demoAlerts.some(
          (a) =>
            a.stationId === 'ST-103' && a.category === 'sensor_connectivity' && !a.resolved
        );
        if (!hasConnAlert) {
          const station = this.data.stations.find((s) => s.id === 'ST-103')!;
          const connAlert: WaterAlert = {
            id: uid('alt'),
            stationId: 'ST-103',
            pipelineLocation: station.pipelineSegment,
            alertType: 'Sensor Disconnected (Demo Simulation)',
            category: 'sensor_connectivity',
            severity: 'critical',
            detectedValue: 'No telemetry heartbeat',
            thresholdReference: `Timeout ${this.data.settings.sensorTimeoutSeconds}s`,
            timestamp: nowIso,
            recommendedAction:
              'Inspect telemetry gateway, solar/battery supply, and LoRa/Wi-Fi uplink at East Industrial Loop.',
            explanation:
              'Simulated sensor disconnection at ST-103 to demonstrate connectivity loss detection.',
            isDemo: true,
            acknowledged: false,
            resolved: false,
          };
          this.data.demoAlerts.unshift(connAlert);
          alertsCreated.push(connAlert);
        }
        continue;
      }

      const stationReadings = this.data.demoReadings.filter((r) => r.stationId === seed.id);
      const prev = stationReadings[stationReadings.length - 1];

      let ph = round(seed.basePh + (Math.random() - 0.5) * 0.14, 2);
      let turbidity = round(Math.max(0.18, seed.baseTurbidity + (Math.random() - 0.5) * 0.14), 2);
      const temperature = round(seed.baseTemp + (Math.random() - 0.5) * 0.6, 1);

      if (scenario === 'turbidity_surge' && (seed.id === 'ST-102' || seed.id === 'ST-104')) {
        turbidity = seed.id === 'ST-102' ? round(4.45 + Math.random() * 0.4, 2) : round(2.35 + Math.random() * 0.35, 2);
      } else if (scenario === 'ph_acidic' && seed.id === 'ST-101') {
        ph = round(5.85 + (Math.random() - 0.5) * 0.15, 2);
      } else if (scenario === 'ph_alkaline' && seed.id === 'ST-105') {
        ph = round(8.92 + (Math.random() - 0.5) * 0.15, 2);
      } else if (scenario === 'sudden_spike' && seed.id === 'ST-104') {
        // Notice: pH jumps sharply (+0.62) yet stays within 6.5-8.5, or turbidity jumps by +0.85 NTU!
        ph = round(7.96 + (Math.random() - 0.5) * 0.08, 2);
        turbidity = round(1.48 + Math.random() * 0.15, 2);
      } else if (scenario === 'normal' && seed.id === 'ST-105') {
        // Keep mild realistic variation around target
        turbidity = round(0.78 + Math.random() * 0.32, 2);
      }

      const deltaPh = prev ? round(ph - prev.ph, 2) : 0;
      const deltaTurb = prev ? round(turbidity - prev.turbidity, 2) : 0;
      const qualityStatus = evaluateReadingStatus(
        ph,
        turbidity,
        deltaPh,
        deltaTurb,
        this.data.settings
      );

      const reading: SensorReading = {
        id: uid('rd'),
        stationId: seed.id,
        pipelineLocation: seed.pipelineSegment,
        ph,
        turbidity,
        temperature,
        timestamp: nowIso,
        isDemo: true,
        source: 'demo_simulator',
        qualityStatus,
        deltaPh,
        deltaTurbidity: deltaTurb,
      };

      this.data.demoReadings.push(reading);
      newReadings.push(reading);

      const station = this.data.stations.find((s) => s.id === seed.id)!;
      const created = this.evaluateAndCreateAlerts(reading, station, this.data.demoAlerts);
      alertsCreated.push(...created);
    }

    if (this.data.demoReadings.length > 2000) {
      this.data.demoReadings = this.data.demoReadings.slice(-2000);
    }
    if (this.data.demoAlerts.length > 250) {
      this.data.demoAlerts = this.data.demoAlerts.slice(0, 250);
    }

    this.data.lastUpdated = nowIso;
    this.refreshStationStatuses();
    this.persist();
    return { newReadings, alertsCreated };
  }

  public acknowledgeAlert(id: string): WaterAlert | null {
    const list = this.getAlertsForMode();
    const target = list.find((a) => a.id === id);
    if (!target) return null;
    target.acknowledged = true;
    this.persist();
    return target;
  }

  public resolveAlert(id: string): WaterAlert | null {
    const list = this.getAlertsForMode();
    const target = list.find((a) => a.id === id);
    if (!target) return null;
    target.acknowledged = true;
    target.resolved = true;
    this.persist();
    return target;
  }

  public saveAiReport(report: AiAnalysisReport): void {
    this.data.aiReports.unshift(report);
    if (this.data.aiReports.length > 30) {
      this.data.aiReports = this.data.aiReports.slice(0, 30);
    }
    this.persist();
  }

  public exportCsv(stationId?: string): string {
    const readings = this.getReadingsForMode();
    const filtered =
      stationId && stationId !== 'all'
        ? readings.filter((r) => r.stationId === stationId)
        : readings;

    const header = [
      'Reading ID',
      'Timestamp (ISO)',
      'Mode',
      'Station ID',
      'Pipeline Location',
      'pH',
      'Turbidity (NTU)',
      'Temperature (C)',
      'Delta pH',
      'Delta Turbidity (NTU)',
      'Status',
      'Source',
    ].join(',');

    const rows = filtered
      .slice()
      .reverse()
      .map((r) =>
        [
          r.id,
          r.timestamp,
          r.isDemo ? 'DEMO DATA' : 'LIVE SENSOR',
          r.stationId,
          `"${r.pipelineLocation.replace(/"/g, '""')}"`,
          r.ph.toFixed(2),
          r.turbidity.toFixed(2),
          r.temperature !== null ? r.temperature.toFixed(1) : '',
          r.deltaPh.toFixed(2),
          r.deltaTurbidity.toFixed(2),
          r.qualityStatus,
          r.source,
        ].join(',')
      );

    return [header, ...rows].join('\n');
  }
}

export const waterStore = new WaterQualityStore();
