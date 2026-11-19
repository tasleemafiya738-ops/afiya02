import type {
  ConnectionStatus,
  MonitoringStation,
  QualityStatus,
  ThresholdSettings,
  WaterAlert,
} from '../types/water';

export function formatTimestamp(iso: string | null): string {
  if (!iso) return 'No data received';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Invalid timestamp';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function getQualityLabel(status: QualityStatus): string {
  switch (status) {
    case 'normal':
      return 'Within Reference Limits';
    case 'warning':
      return 'Warning — Limit Exceeded';
    case 'critical':
      return 'Critical — Immediate Check';
    case 'disconnected':
      return 'Sensor Offline';
  }
}

export function getShortQualityLabel(status: QualityStatus): string {
  switch (status) {
    case 'normal':
      return 'Nominal';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    case 'disconnected':
      return 'Offline';
  }
}

export function getQualityTextColor(status: QualityStatus): string {
  switch (status) {
    case 'normal':
      return 'text-emerald-700';
    case 'warning':
      return 'text-amber-700';
    case 'critical':
      return 'text-red-700';
    case 'disconnected':
      return 'text-slate-500';
  }
}

export function getQualityGlyph(status: QualityStatus): string {
  switch (status) {
    case 'normal':
      return '●';
    case 'warning':
      return '▲';
    case 'critical':
      return '■';
    case 'disconnected':
      return '○';
  }
}

export function getConnectionLabel(conn: ConnectionStatus): string {
  switch (conn) {
    case 'connected':
      return 'Hardware Connected';
    case 'demo_active':
      return 'Demo Stream Active';
    case 'disconnected':
      return 'Disconnected';
  }
}

export function getStationRecommendations(
  station: MonitoringStation,
  settings: ThresholdSettings,
  alerts: WaterAlert[]
): string[] {
  const recs: string[] = [];

  if (station.connectionStatus === 'disconnected') {
    recs.push(
      'Check node power supply, telemetry gateway (Wi-Fi/LoRa/MQTT bridge), and probe cable continuity.'
    );
    return recs;
  }

  const r = station.latestReading;
  if (!r) {
    recs.push('Awaiting initial sensor telemetry packet before generating operational guidance.');
    return recs;
  }

  if (r.ph < settings.phMin || r.ph > settings.phMax) {
    recs.push(
      `pH (${r.ph.toFixed(2)}) is outside ${settings.phMin.toFixed(1)}–${settings.phMax.toFixed(1)}: collect a confirmatory grab sample, inspect treatment dosing, and verify pH electrode buffer calibration.`
    );
  }

  if (r.turbidity > settings.turbidityWarning) {
    recs.push(
      `Turbidity (${r.turbidity.toFixed(2)} NTU) exceeds ${settings.turbidityWarning.toFixed(1)} NTU: check upstream filtration performance, inspect for sediment resuspension, and verify optical flow cell cleanliness.`
    );
  }

  if (
    Math.abs(r.deltaPh) >= settings.phSuddenDelta ||
    Math.abs(r.deltaTurbidity) >= settings.turbiditySuddenDelta
  ) {
    recs.push(
      'Sudden step change detected: inspect the sensor chamber for air bubbles or debris and collect a manual verification sample.'
    );
  }

  const openAlerts = alerts.filter((a) => a.stationId === station.id && !a.resolved);
  if (openAlerts.length === 0 && recs.length === 0) {
    recs.push(
      'pH and turbidity are currently within configured operational limits. Continue routine calibration checks and scheduled laboratory potability testing.'
    );
  }

  return recs;
}
