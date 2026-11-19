export type SystemMode = 'demo' | 'live';

export type QualityStatus = 'normal' | 'warning' | 'critical' | 'disconnected';

export type ConnectionStatus = 'connected' | 'disconnected' | 'demo_active';

export type AlertCategory = 'rule_threshold' | 'sudden_change' | 'sensor_connectivity' | 'ai_anomaly';

export type AlertSeverity = 'warning' | 'critical';

export type DemoScenario =
  | 'normal'
  | 'turbidity_surge'
  | 'ph_acidic'
  | 'ph_alkaline'
  | 'sudden_spike'
  | 'sensor_dropout';

export type NavSection =
  | 'overview'
  | 'live'
  | 'analytics'
  | 'anomaly'
  | 'map'
  | 'alerts'
  | 'reports'
  | 'settings';

export interface ThresholdSettings {
  phMin: number;
  phMax: number;
  turbidityTarget: number;
  turbidityWarning: number;
  turbidityCritical: number;
  phSuddenDelta: number;
  turbiditySuddenDelta: number;
  sensorTimeoutSeconds: number;
}

export interface MonitoringStation {
  id: string;
  name: string;
  pipelineSegment: string;
  zone: string;
  coordinates: {
    x: number; // SVG schematic X (0 - 1000)
    y: number; // SVG schematic Y (0 - 520)
    lat: number;
    lng: number;
  };
  sensorModel: string;
  isDemoStation: boolean;
  lastCalibration: string;
  connectionStatus: ConnectionStatus;
  qualityStatus: QualityStatus;
  lastSeenAt: string | null;
  latestReading: SensorReading | null;
}

export interface SensorReading {
  id: string;
  stationId: string;
  pipelineLocation: string;
  ph: number;
  turbidity: number; // NTU
  temperature: number | null; // °C (optional)
  timestamp: string;
  isDemo: boolean;
  source: 'demo_simulator' | 'iot_rest_api' | 'manual_entry';
  qualityStatus: QualityStatus;
  deltaPh: number;
  deltaTurbidity: number;
}

export interface WaterAlert {
  id: string;
  stationId: string;
  pipelineLocation: string;
  alertType: string;
  category: AlertCategory;
  severity: AlertSeverity;
  detectedValue: string;
  thresholdReference: string;
  timestamp: string;
  recommendedAction: string;
  explanation: string;
  isDemo: boolean;
  acknowledged: boolean;
  resolved: boolean;
}

export interface StatisticalSignal {
  stationId: string;
  stationName: string;
  phZScore: number;
  turbidityZScore: number;
  phBaselineMean: number;
  phBaselineStd: number;
  turbidityBaselineMean: number;
  turbidityBaselineStd: number;
  rateOfChangePh: number;
  rateOfChangeTurbidity: number;
  isStatisticalAnomaly: boolean;
  withinRuleThresholds: boolean;
  patternSummary: string;
  timestamp: string;
  isDemo: boolean;
}

export interface AiAnomalyFinding {
  stationId: string;
  anomalyDetected: boolean;
  confidenceNote: string;
  distinctionType: 'AI Pattern Prediction' | 'Corroborated Threshold & Pattern' | 'Within Expected Baseline';
  severity: 'low' | 'moderate' | 'elevated';
  summary: string;
  comparisonWithBaseline: string;
  possibleDisturbanceFactors: string[];
  recommendedActions: string[];
  limitationsNote: string;
}

export interface AiAnalysisReport {
  id: string;
  createdAt: string;
  mode: SystemMode;
  targetStationId: string | 'all';
  modelUsed: string;
  networkAssessment: string;
  ruleVsAiDistinction: string;
  findings: AiAnomalyFinding[];
  verificationReminder: string;
}

export interface DashboardState {
  mode: SystemMode;
  activeDemoScenario: DemoScenario;
  settings: ThresholdSettings;
  stations: MonitoringStation[];
  readings: SensorReading[];
  alerts: WaterAlert[];
  statisticalSignals: StatisticalSignal[];
  aiReports: AiAnalysisReport[];
  lastUpdated: string;
}
