import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runAiAnomalyAnalysis } from './server/gemini.ts';
import { waterStore } from './server/store.ts';
import type { DemoScenario, SystemMode, ThresholdSettings } from './src/types/water.ts';

dotenv.config();

const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT) || 3000 : 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

// SSE subscribers for real-time telemetry updates
const sseClients = new Set<express.Response>();

function broadcastState(): void {
  const payload = `data: ${JSON.stringify(waterStore.getState())}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Background demo telemetry interval (only emits when mode === 'demo')
setInterval(() => {
  const state = waterStore.getState();
  if (state.mode === 'demo') {
    waterStore.tickDemoData();
    broadcastState();
  } else {
    // In live mode, periodically check sensor timeouts for real connected hardware
    waterStore.refreshStationStatuses();
    broadcastState();
  }
}, 8000);

// --- API ROUTES ---

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'AquaGuard AI Telemetry Server', timestamp: new Date().toISOString() });
});

app.get('/api/state', (_req, res) => {
  res.json(waterStore.getState());
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify(waterStore.getState())}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body as { mode?: SystemMode };
  if (mode !== 'demo' && mode !== 'live') {
    res.status(400).json({ error: 'Invalid mode. Expected "demo" or "live".' });
    return;
  }
  const updated = waterStore.setMode(mode);
  broadcastState();
  res.json(updated);
});

app.post('/api/demo/scenario', (req, res) => {
  const { scenario } = req.body as { scenario?: DemoScenario };
  const valid: DemoScenario[] = [
    'normal',
    'turbidity_surge',
    'ph_acidic',
    'ph_alkaline',
    'sudden_spike',
    'sensor_dropout',
  ];
  if (!scenario || !valid.includes(scenario)) {
    res.status(400).json({ error: 'Invalid demo scenario.' });
    return;
  }
  const updated = waterStore.setDemoScenario(scenario);
  broadcastState();
  res.json(updated);
});

app.post('/api/demo/tick', (_req, res) => {
  waterStore.tickDemoData();
  const state = waterStore.getState();
  broadcastState();
  res.json(state);
});

// Real IoT Hardware REST Ingestion Endpoint (ESP32 / Raspberry Pi / MQTT-HTTP Bridge)
app.post('/api/sensors/ingest', (req, res) => {
  const { stationId, ph, turbidity, temperature, timestamp, pipelineLocation, source } = req.body as {
    stationId?: string;
    ph?: number;
    turbidity?: number;
    temperature?: number | null;
    timestamp?: string;
    pipelineLocation?: string;
    source?: 'iot_rest_api' | 'manual_entry';
  };

  if (!stationId || typeof ph !== 'number' || typeof turbidity !== 'number') {
    res.status(400).json({
      error: 'Missing or invalid required telemetry fields: stationId (string), ph (number), turbidity (number).',
    });
    return;
  }

  if (Number.isNaN(ph) || ph < 0 || ph > 14 || Number.isNaN(turbidity) || turbidity < 0) {
    res.status(400).json({
      error: 'Out-of-bounds physical sensor value. pH must be 0-14 and turbidity >= 0 NTU.',
    });
    return;
  }

  const result = waterStore.ingestReading({
    stationId,
    ph,
    turbidity,
    temperature: typeof temperature === 'number' ? temperature : null,
    timestamp,
    pipelineLocation,
    source: source === 'manual_entry' ? 'manual_entry' : 'iot_rest_api',
  });

  broadcastState();
  res.status(201).json({
    ok: true,
    reading: result.reading,
    alertsCreated: result.alertsCreated,
    state: waterStore.getState(),
  });
});

app.post('/api/stations', (req, res) => {
  const { id, name, pipelineSegment, zone, sensorModel } = req.body as {
    id?: string;
    name?: string;
    pipelineSegment?: string;
    zone?: string;
    sensorModel?: string;
  };
  if (!id || !name || !pipelineSegment) {
    res.status(400).json({ error: 'Station id, name, and pipelineSegment are required.' });
    return;
  }
  const station = waterStore.addStation({
    id,
    name,
    pipelineSegment,
    zone: zone || 'Distribution Network',
    sensorModel: sensorModel || 'ESP32-S3 + pH/Turbidity Node',
  });
  broadcastState();
  res.status(201).json({ station, state: waterStore.getState() });
});

app.put('/api/settings', (req, res) => {
  const body = req.body as Partial<ThresholdSettings>;
  const numericFields: (keyof ThresholdSettings)[] = [
    'phMin',
    'phMax',
    'turbidityTarget',
    'turbidityWarning',
    'turbidityCritical',
    'phSuddenDelta',
    'turbiditySuddenDelta',
    'sensorTimeoutSeconds',
  ];

  const sanitized: Partial<ThresholdSettings> = {};
  for (const key of numericFields) {
    if (typeof body[key] === 'number' && !Number.isNaN(body[key])) {
      sanitized[key] = body[key];
    }
  }

  if (
    sanitized.phMin !== undefined &&
    sanitized.phMax !== undefined &&
    sanitized.phMin >= sanitized.phMax
  ) {
    res.status(400).json({ error: 'pH minimum must be strictly less than pH maximum.' });
    return;
  }

  const updated = waterStore.updateSettings(sanitized);
  broadcastState();
  res.json(updated);
});

app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const alert = waterStore.acknowledgeAlert(req.params.id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found in current mode.' });
    return;
  }
  broadcastState();
  res.json({ alert, state: waterStore.getState() });
});

app.post('/api/alerts/:id/resolve', (req, res) => {
  const alert = waterStore.resolveAlert(req.params.id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found in current mode.' });
    return;
  }
  broadcastState();
  res.json({ alert, state: waterStore.getState() });
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { stationId } = (req.body || {}) as { stationId?: string };
    const state = waterStore.getState();

    if (state.readings.length === 0) {
      res.status(400).json({
        error:
          'No telemetry readings are available in Live Sensor Mode yet. Connect hardware via POST /api/sensors/ingest or switch to Demo Mode to test AI anomaly detection.',
      });
      return;
    }

    const report = await runAiAnomalyAnalysis({
      mode: state.mode,
      targetStationId: stationId && stationId !== 'all' ? stationId : 'all',
      stations: state.stations,
      readings: state.readings,
      statisticalSignals: state.statisticalSignals,
      activeAlerts: state.alerts,
      settings: state.settings,
    });

    waterStore.saveAiReport(report);
    broadcastState();
    res.json({ report, state: waterStore.getState() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run Gemini AI anomaly analysis.';
    console.error('AI Analysis Error:', err);
    res.status(500).json({ error: message });
  }
});

app.get('/api/reports/csv', (req, res) => {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : 'all';
  const csv = waterStore.exportCsv(stationId);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="aquaguard-water-quality-${stationId}-${stamp}.csv"`
  );
  res.send(csv);
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AquaGuard AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
